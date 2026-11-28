import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CategoryDTO } from "@/types/features/demo/category";

export type CoverStyle = "Orbit" | "Bands" | "Grid";
export function drawCourseCover(canvas: HTMLCanvasElement, name: string, category: string, code: string, level: string, style: CoverStyle, variation: number) {
  canvas.width=1200; canvas.height=630;
  const ctx=canvas.getContext("2d"); if (!ctx) throw new Error("Canvas cover generation is unavailable in this browser.");
  ctx.fillStyle="#0f172a"; ctx.fillRect(0,0,1200,630);
  ctx.fillStyle=["#334155","#475569","#1e293b"][Array.from(code).reduce((sum,c)=>sum+c.codePointAt(0)!,0)%3];
  const shift=(variation%5)*35;
  if (style==="Orbit") { ctx.beginPath();ctx.arc(1070,80+shift,280,0,Math.PI*2);ctx.fill(); }
  else if (style==="Bands") { ctx.fillRect(850-shift,0,350,630);ctx.fillRect(0,605,1200,25); }
  else { for(let x=780;x<1200;x+=65) for(let y=20;y<630;y+=65) ctx.fillRect(x,y,28+(variation%3)*5,28); }
  ctx.fillStyle="#ffffff"; ctx.font="bold 28px sans-serif";
  ctx.fillText(code.slice(0,8)||"CM",70,90);
  const lines=(text: string,width: number) => {
    const result: string[]=[];let line="";
    for(const char of text) { if(line && ctx.measureText(line+char).width>width) {result.push(line);line="";}line+=char; }
    return [...result,line];
  };
  ctx.font="24px sans-serif";
  lines(category||"Course",1040).forEach((line,i)=>ctx.fillText(line,70,140+i*30));
  let size=54;let title: string[]=[];
  do {ctx.font=`bold ${size}px sans-serif`;title=lines(name||"Untitled course",1040);if(title.length<=5)break;size-=2;} while(size>=28);
  title.forEach((line,i)=>ctx.fillText(line,70,250+i*(size+10)));
  ctx.font="26px sans-serif";ctx.fillText(level ? level.charAt(0)+level.slice(1).toLowerCase() : "Level not specified",70,580);
  return canvas.toDataURL("image/png");
}
interface Props {
  value: string; form: Record<string, any>; categories: CategoryDTO[];
  onChange: (name: string,value: any)=>void; disabled: boolean;
}
export function CourseCoverEditor({ value,form,categories,onChange,disabled }: Props) {
  const canvas=useRef<HTMLCanvasElement>(null);
  const [style,setStyle]=useState<CoverStyle>("Orbit");
  const [variation,setVariation]=useState(0);
  const [preview,setPreview]=useState("");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [selected,setSelected]=useState(false);
  const category=categories.filter(c=>(form.categoryIds??[]).map(Number).includes(Number(c.id))).sort((a,b)=>(a.code??"").localeCompare(b.code??""))[0];
  function generate(nextStyle=style,nextVariation=variation) {
    try {
      const data=drawCourseCover(canvas.current!,String(form.name??""),category?.name??"",category?.code??"",String(form.level??""),nextStyle,nextVariation);
      setPreview(data);setSelected(false);setError("");
    } catch(e) {setError(e instanceof Error ? e.message : "Could not generate cover. Your current cover is preserved.");}
  }
  async function upload(file?: File) {
    if(!file) return;
    if(!["image/png","image/jpeg","image/gif","image/webp"].includes(file.type) || file.size>2*1024*1024) {setError("Choose a PNG, JPEG, GIF or WebP image of 2 MB or smaller.");return;}
    setBusy(true);setError("");
    const url=URL.createObjectURL(file);
    try {
      const image=new Image();image.src=url;await image.decode();
      if(image.naturalWidth*image.naturalHeight>16_000_000) throw new Error("Cover dimensions are too large.");
      const target=canvas.current!; target.width=image.naturalWidth;target.height=image.naturalHeight;
      const ctx=target.getContext("2d");if(!ctx)throw new Error("Image preview is unavailable.");ctx.drawImage(image,0,0);
      const data=target.toDataURL("image/png");
      if(data.length>2_796_230)throw new Error("Converted cover must be 2 MB or smaller. Choose a smaller image.");
      setPreview(data);setSelected(false);
    } catch(e) {setError(e instanceof Error ? e.message : "Could not read this image. Your current cover is preserved.");}
    finally {URL.revokeObjectURL(url);setBusy(false);}
  }
  return <fieldset disabled={disabled||busy} className="space-y-3 rounded border p-3">
    <legend className="px-1 font-medium">Course cover</legend>
    <label className="grid gap-1 text-sm">Image URL<Input value={value??""} maxLength={255} onChange={e=>{onChange("thumbnailUrl",e.target.value);onChange("coverImage",null);setSelected(false);}} /></label>
    <p className="text-xs text-muted-foreground">An empty cover is generated when the course is saved. Existing covers are preserved. Select a preview to replace one.</p>
    <label className="grid gap-1 text-sm">Cover style<select aria-label="Cover style" className="rounded border bg-background p-2" value={style} onChange={e=>{const next=e.target.value as CoverStyle;setStyle(next);generate(next);}}>{["Orbit","Bands","Grid"].map(item=><option key={item}>{item}</option>)}</select></label>
    <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={()=>generate()}>Preview cover</Button><Button type="button" variant="outline" onClick={()=>{setVariation(variation+1);generate(style,variation+1);}}>Generate another variation</Button></div>
    <label className="grid gap-1 text-sm">Upload image (maximum 2 MB)<input type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={e=>{void upload(e.target.files?.[0]);e.target.value="";}}/></label>
    <canvas ref={canvas} hidden aria-hidden="true"/>
    {preview && <><img src={preview} alt="Course cover preview" className="aspect-[1200/630] w-full rounded object-contain"/><Button type="button" variant="outline" onClick={()=>{onChange("coverImage",preview);setSelected(true);}}>Use this cover</Button></>}
    {busy && <p role="status">Preparing image…</p>}
    {form.coverImage && <p role="status">Cover selected. Save the course to upload and store it.{!selected && " Your previously selected image is retained until you choose this preview."}</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </fieldset>;
}
