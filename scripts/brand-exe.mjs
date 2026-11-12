import * as P from 'pe-library';
import * as R from 'resedit';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
export function brandExecutable(bytes,version){
 const match=/^(\d{4})(\d{2})(\d{2})\.(\d{3})$/.exec(version);if(!match)throw Error('Invalid display version');
 const exe=P.NtExecutable.from(bytes,{ignoreCert:true}),res=P.NtExecutableResource.from(exe);
 const versions=R.Resource.VersionInfo.fromEntries(res.entries);if(!versions.length)throw Error('Missing PE version info');
 for(const vi of versions){vi.setFileVersion(...match.slice(1).map(Number));vi.setProductVersion(...match.slice(1).map(Number));for(const lang of vi.getAllLanguagesForStringValues())vi.setStringValues(lang,{FileDescription:'3wa_3dviewer',ProductName:'3wa_3dviewer',InternalName:'3wa_3dviewer',OriginalFilename:'3wa_3dviewer.exe',CompanyName:'3WA',LegalCopyright:'3WA · 阿寶 / 羽山秋人',FileVersion:version,ProductVersion:version});vi.outputToResourceEntries(res.entries);}
 res.outputResource(exe);return Buffer.from(exe.generate());
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const [file,version]=process.argv.slice(2);fs.writeFileSync(file,brandExecutable(fs.readFileSync(file),version));}
