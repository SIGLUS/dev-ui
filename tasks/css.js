
module.exports = function(grunt){
    var fs = require('fs-extra'),
    replace = require('replace'),
    path = require('path'),
    Concat = require('concat-with-sourcemaps'),
    convertSourceMap = require('convert-source-map'),
    wiredep = require('wiredep'),
    glob = require('glob'),
    sass = require('node-sass')
    inEachAppDir = require('../ordered-application-directory');

    var tmpDir = 'css';

    grunt.registerTask('openlmis.css', ['openlmis.css:copy', 'openlmis.css:build']);

    grunt.registerTask('openlmis.css:copy', function(){
        var dest = path.join(process.cwd(), grunt.option('app.tmp'), tmpDir);

        inEachAppDir(function(dir){
            var src = grunt.option('app.src');
            var config = grunt.file.readJSON(path.join(dir, 'config.json'));
            if(config && config.app && config.app.src) src = config.app.src;

            glob.sync('**/*.scss', {
                cwd: path.join(dir, src)
            }).forEach(function(file){
                fs.copySync(path.join(dir, src, file), path.join(dest, file));
            });

            if(!fs.existsSync(path.join(dir, 'bower_components'))){
                return ;
            }
            
            var bowerCss = wiredep().css || [];
            var bowerScss = wiredep().scss || [];
            bowerCss.concat(bowerScss).forEach(function(file){
                // copy each file into a directory called bower_components
                var bowerPath = file.substring(file.indexOf("bower_components"));
                fs.copySync(file, path.join(dest, bowerPath));
            });
        });
    });

    grunt.registerTask('openlmis.css:build', function(){
        var dest = grunt.option('app.dest');
        var tmp = path.join(grunt.option('app.tmp'), tmpDir);

        buildScss('openlmis.scss', tmp);

        var sassResult = sass.renderSync({
            file: path.join(tmp, 'openlmis.scss'),
            includePaths: getIncludePaths()
        });

        fs.writeFileSync(path.join(dest,'openlmis.css'), sassResult.css);

        // remove non-relative strings
        replace({
            regex: '../',
            replacement: '',
            silent: true,
            paths:[path.join(dest, 'openlmis.css')]
        });
    });

    function buildScss(fileName, dest){
        var tmp = grunt.option('app.tmp');

        var concat = new Concat(true, fileName, '\n');
        // Set general file patterns we want to ignore
        var ignorePatterns = [];
        // Helper function to keep ordered file adding clear
        function addFiles(pattern, extraIgnore){
            if (!extraIgnore) extraIgnore = [];

            glob.sync(pattern, {
                cwd: tmp,
                ignore: ignorePatterns.concat(extraIgnore)
            }).forEach(function(file){
                var filePath = path.join(tmp, file);

                // Don't let previously added patterns be added again
                ignorePatterns.push(pattern);
                
                var contentBuffer = fs.readFileSync(filePath);
                concat.add(file, contentBuffer);
            });
        }

        addFiles('**/*variables.scss', ['bower_components/**/*']);

        addFiles('bower_components/**/*.scss');
        addFiles('bower_components/**/*.css');

        addFiles('**/mixins.scss');
        addFiles('**/*.scss');
        addFiles('**/*.css');

        // TODO: Write/add sourcemaps

        fs.writeFileSync(path.join(dest, fileName), concat.content);
    }

    function getIncludePaths(){
        // Include paths are the directories imported sass files live in
        // so that import statements in the files will work correctly
        var includePaths = require('node-bourbon').includePaths; // because this is an array, we start here
        inEachAppDir(function(dir){
            if(!fs.existsSync(path.join(dir, 'bower_components'))){
                return ;
            }

            var bowerScss = wiredep().scss || [];
            bowerScss.forEach(function(filePath){
                var fileDirectory = filePath.substring(0, filePath.lastIndexOf("/"));
                includePaths.push(fileDirectory);
            });
        });

        return includePaths;
    }
}
