#!/usr/bin/env node
// @ts-check
const { Program } = require('3h-cli'),
    { existsSync, promises: fsPromises } = require('fs'),
    { execSync } = require('child_process'),
    { join } = require('path'),
    // @ts-ignore
    pkgInfo = require('./package.json');

/* Template data slot: __var__ */

const TEMPLATE_PATH = './template',
    TEMPLATE_ENCODING = 'utf8';

const templateDirectories = [
    'src',
    'test',
];

const templateFiles = [
    'src/index.ts',
    'test/index.js',
    'CHANGELOG.md',
    'LICENSE',
    'README.md',
    'tsconfig.json',
];

/**
 * @typedef TemplateData
 * @property {string} name
 * @property {string} desc
 * @property {string} author
 * @property {string} year
 */

/**
 * @param {TemplateData} data
 */
const renderTemplates = async data => {
    await templateDirectories.reduce(
        (prevPromise, dir) => prevPromise.then(() => fsPromises.mkdir(dir)),
        Promise.resolve()
    );
    await Promise.all(
        templateFiles.map(async path => {
            let content = await fsPromises.readFile(
                join(__dirname, TEMPLATE_PATH, path),
                TEMPLATE_ENCODING
            );
            Object.entries(data).forEach(([key, value]) => {
                content = content.replace(
                    new RegExp(`__${key}__`, 'g'),
                    value
                );
            });
            await fsPromises.writeFile(path, content);
        })
    );
};

const program = new Program(pkgInfo.name, {
    title: pkgInfo.description
});

program
    .option({
        name: '--name',
        alias: '-n',
        value: '<pkg>',
        help: 'The name of the package'
    })
    .option({
        name: '--author',
        alias: '-a',
        value: '<name>',
        help: 'The author of the package'
    })
    .option({
        name: '--desc',
        alias: '-d',
        value: '<description>',
        help: 'The description of the package'
    })
    .option({
        name: '--keywords',
        alias: '-k',
        value: '<words...>',
        help: 'The keywords of the package'
    })
    .option({
        name: '--repo',
        alias: '-r',
        value: '<repository>',
        help: 'The repository of the package'
    })
    .option({
        name: '--no-install',
        help: 'Do not install dependencies instantly'
    })
    .option({
        name: '--help',
        alias: '-h',
        help: 'Show help info'
    })
    .parse(process.argv)
    .then(async args => {

        const { options } = args;

        if (options.has('--help')) {
            return program.help();
        }

        if (!options.has('--name')) {
            throw 'Package name is not provided';
        }

        const name = options.get('--name')[0];

        if (existsSync(name)) {
            throw `Path "${name}" already exists`;
        }

        if (!options.has('--author')) {
            throw 'Package author is not provided';
        }

        const data = {
            name,
            desc: args.getOption('--desc')[0] || `This is ${name}.`,
            author: options.get('--author')[0],
            year: (new Date()).getFullYear() + '',
        };

        await fsPromises.mkdir(name);
        process.chdir(name);

        console.time('time used');

        console.log('Generating files...');
        await renderTemplates(data);
        await fsPromises.writeFile('package.json', JSON.stringify(
            {
                name,
                version: '0.1.0',
                description: data.desc,
                main: `./js/${name}.js`,
                types: './types/index.d.ts',
                author: data.author,
                license: 'MIT',
                scripts: {
                    build: 'tsc',
                    docs: 'dts2md -i ./types -o ./docs -l -- * !index.d.ts',
                },
                repository: args.getOption('--repo')[0]
                    || `${data.author}/${name}`,
                keywords: args.getOption('--keywords'),
                files: [
                    'dist',
                    'types',
                    'index.d.ts'
                ],
                devDependencies: {
                    dts2md: '^0.1.0',
                    typescript: '^3.8.0',
                    '@types/node': '^13.7.0'
                }
            },
            null, // replacer
            2 // indent
        ));

        if (options.has('--no-install')) {
            console.log('Dependencies not installed.');
        } else {
            console.log('Installing dev dependencies...');
            execSync('npm i', { stdio: 'inherit' });
        }

        console.log('Finished!');
        console.timeEnd('time used');

    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
