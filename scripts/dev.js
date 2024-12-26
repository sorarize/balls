const browserSync = require('browser-sync').create();
const nodemon = require('nodemon');

// 啟動 nodemon
nodemon({
    script: 'src/server.js',
    watch: ['src'],
    ext: 'js,json'
}).on('start', () => {
    // 當 nodemon 啟動時，等待一下再啟動 browser-sync
    setTimeout(() => {
        browserSync.init({
            proxy: 'localhost:3000',
            files: ['public/**/*.*'],
            port: 3001,
            open: false,
            notify: false
        });
    }, 1000);
});

// 監聽 nodemon 事件
nodemon.on('quit', () => {
    browserSync.exit();
    process.exit();
});

nodemon.on('restart', () => {
    setTimeout(() => {
        browserSync.reload();
    }, 1000);
});
