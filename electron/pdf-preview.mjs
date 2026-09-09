import fs from 'node:fs/promises';
export async function pdfPreview(file,number=1){
  if(!Number.isInteger(number)||number<1)throw new Error('Choose a valid page number.');
  const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task=getDocument({data:new Uint8Array(await fs.readFile(file)),useSystemFonts:true,isEvalSupported:false});
  try{
    const doc=await task.promise,page=await doc.getPage(Math.min(number,doc.numPages)),size=page.getViewport({scale:1});
    const viewport=page.getViewport({scale:Math.min(1.5,900/size.width,900/size.height)}),canvas=doc.canvasFactory.create(Math.ceil(viewport.width),Math.ceil(viewport.height));
    try{await page.render({canvasContext:canvas.context,viewport}).promise;return{url:'data:image/png;base64,'+canvas.canvas.toBuffer('image/png').toString('base64'),pages:doc.numPages,page:page.pageNumber};}
    finally{doc.canvasFactory.destroy(canvas);}
  }finally{await task.destroy();}
}
