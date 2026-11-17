// Fixed packaged entry: no caller-selected executable or script.
const i=process.argv.indexOf('--viewer-capture-job');
if(i>=0){if(i!==1||process.argv.length!==3)throw Error('Invalid capture invocation');process.argv=[process.execPath,__filename,process.argv[i+1]];require('./capture-main.cjs');}
else require('./main.cjs');
