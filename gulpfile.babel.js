import gulp     from 'gulp';
import plugins  from 'gulp-load-plugins';
import browser  from 'browser-sync';
import mq       from 'media-query-extractor';
import rimraf   from 'rimraf';
import panini   from 'panini';
import yargs    from 'yargs';
import lazypipe from 'lazypipe';
import inky     from 'inky';

const $ = plugins();

// Look for the --production flag
const PRODUCTION = !!(yargs.argv.production);

// Only inline if the --production flag is enabled
var buildTasks = [clean, pages, sass, images];
if (PRODUCTION) buildTasks.push(inline);

// Build the "dist" folder by running all of the above tasks
gulp.task('build',
  gulp.series.apply(gulp, buildTasks));

// Build emails, run the server, and watch for file changes
gulp.task('default',
  gulp.series('build', server, watch));

// Delete the "dist" folder
// This happens every time a build starts
function clean(done) {
  rimraf('dist', done);
}

// Compile layouts, pages, and partials into flat HTML files
// Then parse using Inky templates
function pages() {
  return gulp.src('src/pages/**/*.html')
    .pipe(inky())
    .pipe(panini({
      root: 'src/pages',
      layouts: 'src/layouts',
      partials: 'src/partials',
      helpers: 'src/helpers',
      data: 'src/data'
    }))
    .pipe(gulp.dest('dist'));
}

// function parseInk() {
//   return gulp.src(['src/pages/**/*.html', 'src/partials/**/*.html'])
//     .pipe(inky())
// }

// Reset Panini's cache of layouts and partials
function resetPages(done) {
  panini.refresh();
  done();
}

// Compile Sass into CSS
function sass() {
  return gulp.src('src/assets/scss/app.scss')
    .pipe($.if(!PRODUCTION, $.sourcemaps.init()))
    .pipe($.sass({
      includePaths: ['node_modules/foundation-emails/scss']
    }).on('error', $.sass.logError))
    .pipe($.if(!PRODUCTION, $.sourcemaps.write()))
    .pipe(gulp.dest('dist/css'));
}

// Copy and compress images
function images() {
  return gulp.src('src/assets/img/*')
    .pipe($.imagemin())
    .pipe(gulp.dest('./dist/assets/img'));
}

// Inline CSS and minify HTML
function inline() {
  return gulp.src('dist/**/*.html')
    .pipe(inliner({
      css: 'dist/css/app.css',
      hover_css: 'src/assets/scss/_hovers.css'
    }))
    .pipe(gulp.dest('dist'));
}

// Start a server with LiveReload to preview the site in
function server(done) {
  browser.init({
    server: 'dist',
    open: false  // Stop the browser from automatically opening
  });
  done();
}

// Watch for file changes
function watch() {
  gulp.watch('src/pages/**/*.html', gulp.series(pages, browser.reload));
  gulp.watch(['src/layouts/**/*', 'src/partials/**/*'], gulp.series(resetPages, pages, browser.reload));
  gulp.watch(['../scss/**/*.scss', 'src/assets/scss/**/*.scss'], gulp.series(sass, browser.reload));
  gulp.watch('src/img/**/*', gulp.series(images, browser.reload));
}

// Inlines CSS into HTML, adds media query CSS into the <style> tag of the email, and compresses the HTML
function inliner(options) {
  var cssPath = options.css;
  var cssMqPath_sm = cssPath.replace(/\.css$/, '500-mq.css');
  var cssMqPath_md = cssPath.replace(/\.css$/, '745-mq.css');
  var cssHoverPath = options.hover_css;

  // Extracts media query-specific CSS into a separate file
  mq(cssPath, cssMqPath_sm, [
    'only screen and (max-width: 500px)|' + cssMqPath_sm
  ]);
  mq(cssPath, cssMqPath_md, [
    'only screen and (max-width: 745px)|' + cssMqPath_md
  ]);

  var pipe = lazypipe()
    .pipe($.inlineCss)
    .pipe($.inject, gulp.src(cssHoverPath), {
      name: 'hover',
      transform: function(path, file) {
        return '<style type="text/css">\n' + file.contents.toString() + '\n</style>';
      }
    })
    .pipe($.inject, gulp.src([cssMqPath_sm, cssMqPath_md]), {
      transform: function(path, file) {
        return '<style type="text/css">\n' + file.contents.toString() + '\n</style>';
      }
    })
    .pipe($.htmlmin, {
      collapseWhitespace: false,
      minifyCSS: true
    });

  return pipe();
}
