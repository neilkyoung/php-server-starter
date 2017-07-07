const gulp = require('gulp');
const gulpLoadPlugins = require('gulp-load-plugins');
const del = require('del');
const browserSync = require('browser-sync').create();
const runSequence = require('run-sequence');
const connect = require('gulp-connect-php');
const httpProxy = require('http-proxy');

const source = require('vinyl-source-stream');
const browserify = require('browserify');
const babelify = require('babelify');
//const wiredep = require('wiredep').stream;

const $ = gulpLoadPlugins();
const reload = browserSync.reload;

let dev = true;
let port = 9000;

gulp.task('styles', () => {
    return gulp.src('src/css/*.scss')
        .pipe($.plumber())
        .pipe($.if(dev, $.sourcemaps.init()))
        .pipe($.sass.sync({
            outputStyle: 'expanded',
            precision: 10,
            includePaths: ['.']
        }).on('error', $.sass.logError))
        .pipe($.autoprefixer({
            browsers: ['> 1%', 'last 2 versions', 'Firefox ESR']
        }))
        .pipe($.if(dev, $.sourcemaps.write()))
        .pipe(gulp.dest('.tmp/css'))
        .pipe(reload({
            stream: true
        }));
})

gulp.task('scripts', () => {

    return browserify("src/js/index.js", {
            debug: true
        })
        .transform(babelify)
        .bundle()
        .pipe(source('index.js'))
        .pipe(gulp.dest('.tmp/js'))
        .pipe(reload({
            stream: true
        }))
});

function lint(files) {
    return gulp.src(files)
        .pipe($.eslint({
            fix: true
        }))
        .pipe(reload({
            stream: true,
            once: true
        }))
        .pipe($.eslint.format())
        .pipe($.if(!browserSync.active, $.eslint.failAfterError()));
}

gulp.task('lint', () => {
    return lint('src/js/**/*.js')
        .pipe(gulp.dest('src/scripts'));
})

gulp.task('html', ['styles', 'scripts'], () => {
    return gulp.src(['src/*.html', 'src/*.php'])
        .pipe($.useref({
            searchPath: ['.tmp', 'src', '.']
        }))
        .pipe($.if(/\.js$/, $.uglify({
            compress: {
                drop_console: true
            }
        })))
        .pipe($.if(/\.css$/, $.cssnano({
            safe: true,
            autoprefixer: false
        })))
        .pipe(gulp.dest('dist'));
})

// gulp.task('bower', () => {
//   gulp.src('src/*.html')
//   .pipe(wiredep())
//   .pipe(gulp.dest('src'));
// })


gulp.task('clean', del.bind(null, ['.tmp', 'dist']));

gulp.task('php-serve', () => {
    connect.server({
        port: 9001,
        base: 'src',
        open: false
    });

    var proxy = httpProxy.createProxyServer({});

    runSequence(['clean'], ['styles', 'scripts'], () => {
      browserSync.init({
          notify: false,
          port  : 9000,
          server: {
              baseDir   : ['.tmp', 'src'],
              routes    : {
                  '/bower_components': 'bower_components'
              },
              middleware: function (req, res, next) {
                  var url = req.url;

                  if (!url.match(/^\/(css|fonts|bower_components)\//)) {
                      proxy.web(req, res, { target: 'http://127.0.0.1:9001' });
                  } else {
                      next();
                  }
              }
          }
      });
    });

    // watch for changes
    gulp.watch([
        'src/*.html',
        'src/js/**/*.js',
        'src/*.php',
    ]).on('change', reload);

    gulp.watch('src/css/**/*.scss', ['styles']);
    gulp.watch('src/js/**/*.js', ['scripts']);
});

gulp.task('php-serve:dist', ['default'], () => {
  connect.server({
      port: 9001,
      base: 'dist',
      open: false
  });

  var proxy = httpProxy.createProxyServer({});

  browserSync.init({
      notify: false,
      port  : 9000,
      server: {
          baseDir   : ['dist'],
          middleware: function (req, res, next) {
              var url = req.url;

              if (!url.match(/^\/(css|js)\//)) {
                  proxy.web(req, res, { target: 'http://127.0.0.1:9001' });
              } else {
                  next();
              }
          }
      }
  });
});

gulp.task('build', ['lint', 'html']);
gulp.task('default', () => {
    return new Promise(resolve => {
        dev = false;
        runSequence(['clean'], 'build', resolve);
    });
})
