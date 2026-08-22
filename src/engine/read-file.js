/** 파일 → 텍스트 라인 (xlsx · pdf · csv · txt) */
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf';
import 'pdfjs-dist/legacy/build/pdf.worker.entry';
export function linesFromFile(file){
  var ext=(file.name.split('.').pop()||'').toLowerCase();
  return new Promise(function(res,rej){
    var fr=new FileReader();
    fr.onerror=function(){ rej(new Error('파일을 읽지 못했습니다')); };
    if(ext==='xls'||ext==='xlsx'||ext==='csv'){
      fr.onload=function(e){
        try{
          var wb=XLSX.read(new Uint8Array(e.target.result),{type:'array'});
          var out=[];
          wb.SheetNames.forEach(function(n){
            var rows=XLSX.utils.sheet_to_json(wb.Sheets[n],{header:1,blankrows:false,defval:''});
            rows.forEach(function(r){
              var t=r.map(function(c){ return String(c).trim(); }).filter(Boolean).join(' ');
              if(t) out.push(t);
            });
          });
          res(out);
        }catch(err){ rej(err); }
      };
      fr.readAsArrayBuffer(file);
    } else if(ext==='pdf'){
      fr.onload=function(e){
        try{
          if(pdfjsLib.GlobalWorkerOptions) pdfjsLib.GlobalWorkerOptions.workerSrc='';
          pdfjsLib.getDocument({data:new Uint8Array(e.target.result)}).promise.then(function(pdf){
            var jobs=[];
            for(var i=1;i<=pdf.numPages;i++) jobs.push(pdf.getPage(i).then(function(pg){ return pg.getTextContent(); }));
            Promise.all(jobs).then(function(pages){
              var out=[];
              pages.forEach(function(tc){
                var cur=null, lastY=null;
                tc.items.forEach(function(t){
                  var y=Math.round(t.transform[5]);
                  if(lastY===null||Math.abs(y-lastY)>3){ if(cur) out.push(cur.trim()); cur=t.str; lastY=y; }
                  else cur+=' '+t.str;
                });
                if(cur) out.push(cur.trim());
              });
              res(out.filter(Boolean));
            }).catch(rej);
          }).catch(rej);
        }catch(err){ rej(err); }
      };
      fr.readAsArrayBuffer(file);
    } else {
      fr.onload=function(e){ res(String(e.target.result).split(/\r?\n/)); };
      fr.readAsText(file);
    }
  });
}
