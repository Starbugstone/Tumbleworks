import{mkdirSync,writeFileSync,appendFileSync}from'node:fs';
const base='output/current/village-layouts/parallel44/gardens/live64/runs';
function folder(){const label=process.env['GR55_LABEL'];if(!label)return; if(!/^[a-zA-Z0-9_-]+$/.test(label))throw new Error('Future authorized run requires a fresh explicit GR55_LABEL');const f=`${base}/${label}`;mkdirSync(f,{recursive:true});return f;}
/** Used ONLY after a future root live/CPU grant; all first outcomes survive. */
export function record55(name:string,data:unknown){const directory=folder();if(!directory)return;writeFileSync(`${directory}/${name}.json`,JSON.stringify(data,null,2),{flag:'wx'});}
export function raw55(name:string){const directory=folder();if(!directory)return(_row:unknown)=>undefined;const path=`${directory}/${name}.jsonl`;writeFileSync(path,'',{flag:'wx'});return(row:unknown)=>appendFileSync(path,JSON.stringify(row)+'\n');}
