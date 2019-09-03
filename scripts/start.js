#!/usr/bin/env node
'use strict';

const _ = require('lodash');
const browserSync = require('browser-sync').create();
const exec = require('child_process').exec;

const CONFIG = require('./_config');
const { compileScripts, compileStyles } = require('./_compile');
const { copyDist } = require('./_util/copy');
const { generateAll, generateApis } = require('./_generate');

const serverRoutes = {};
serverRoutes[CONFIG.site.baseHref] = CONFIG.publicDir;

browserSync.emitter.on('init', () => {
    console.log('Starting a selenium webdriver instance...');
    exec('yarn webdriver:start', { cwd: CONFIG.testDir }); // don't log anything to the dev server
});

browserSync.init({
    logLevel: 'debug',
    notify: false,
    open: false,
    reloadOnRestart: true,
    reloadDebounce: 250,
    server: {
        baseDir: CONFIG.publicDir,
        routes: serverRoutes
    },
    watchEvents: ['change'],
    files: [
        // Reload browser if any file in public directory changes
        `${CONFIG.publicDir}/*`,
        `${CONFIG.publicDir}/**/*`,

        // Regenerate docs if anything changes in the docs directory
        // or if any LightDOM CSS changes in the source directory
        {
            match: [
                `${CONFIG.docsDir}/*`,
                `${CONFIG.docsDir}/**/*`,
                // Light DOM CSS changes
                `${CONFIG.sourceDir}/*.less`,
                `${CONFIG.sourceDir}/less/**/*.less`,
                // Ignore raw API data files
                `!${CONFIG.docsDir}/api/*`,
                `!${CONFIG.docsDir}/api/**/*`,
            ],
            fn: _.debounce(function () {
                compileStyles();
                generateAll();
            }, 1500),
        },

        // Recompile toolkit scripts if any JS file changes in source directory
        {
            match: [
                `${CONFIG.sourceDir}/*.js`,
                `${CONFIG.sourceDir}/**/*.js`,
                // OLD Shadow DOM
                `${CONFIG.sourceDir}/elements/*.less`, // (+) ShadowDOM CSS
                `${CONFIG.sourceDir}/elements/*.html`, // (+) ShadowDOM Markup
                // NEW Shadow DOM
                `${CONFIG.sourceDir}/elements/**/_shadow.*`,
            ],
            fn: _.debounce(compileScripts, 1500),
        },

        // Generate API docs when src files change
        {
            match: [
                `${CONFIG.sourceDir}/*.js`,
                `${CONFIG.sourceDir}/**/*.js`,
                `${CONFIG.sourceDir}/*.md`,
                `${CONFIG.sourceDir}/**/*.md`,
            ],
            fn: _.debounce(generateApis, 1500),
        },

        // Only copy when files change in dist/
        {
            match: [
                `${CONFIG.distDir}/*`,
                `${CONFIG.distDir}/**/*`,
            ],
            fn: _.debounce(copyDist, 1500),
        },

        // Re-transpile test files
        {
            match: [
                `${CONFIG.testDir}/**/*.ts`,
                `!${CONFIG.testDir}/node_modules/**`,
                `!${CONFIG.testDir}/built/**/*`,
            ],
            fn: _.debounce(() => {
                const tsc = exec('yarn build', { cwd: CONFIG.testDir });
                tsc.stdout.pipe(process.stdout);
                tsc.stderr.pipe(process.stderr);
            }, 1500),
        },
    ],
});
