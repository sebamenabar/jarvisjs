import Jasmine from 'jasmine';

const jasmine = new Jasmine({});
jasmine.loadConfig({
  spec_dir: __dirname.split('/').reverse()[0],
  helpers: [],
  spec_files: [process.argv[2]],
});
jasmine.execute();
