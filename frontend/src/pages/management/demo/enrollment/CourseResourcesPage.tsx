import {useLocation} from "react-router-dom";
import {useSelector} from "react-redux";
import {useQuery} from "@tanstack/react-query";
import axios from "@/api/axios";
import {MainLayout} from "@/components/layout/MainLayout";
import {Button} from "@/components/ui/button";
import type {RootState} from "@/store/store";
export default function CourseResourcesPage(){
 const kind=useLocation().pathname.slice(1);const {email,permissions}=useSelector((s:RootState)=>s.auth);
 const allowed=permissions.includes("ADMIN_ACCESS")&&permissions.includes("COURSE_READ");
 const query=useQuery<Record<string,unknown>[]>({queryKey:["course-resources",email,kind],queryFn:async()=>(await axios.get(`/course-resources/${kind}`)).data,enabled:allowed,retry:false});
 const title=kind.split("-").map(s=>s[0].toUpperCase()+s.slice(1)).join(" ");
 return <MainLayout><h1 className="mb-6 text-2xl font-bold">{title}</h1>{!allowed?<p>Access denied.</p>:query.isPending?<p>Loading...</p>:query.isError?<div role="alert">Could not load records. <Button onClick={()=>void query.refetch()}>Try again</Button></div>:<div className="overflow-x-auto rounded-xl border"><table className="w-full text-left text-sm"><thead className="bg-muted"><tr>{["ID","Course / Lesson","User","Date","Details"].map(h=><th key={h} className="p-4">{h}</th>)}</tr></thead><tbody>{query.data.length?query.data.map(row=><tr key={String(row.id)} className="border-t">{["id","course","user","date","detail"].map(key=><td key={key} className="p-4">{String(row[key]??"—")}</td>)}</tr>):<tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No records.</td></tr>}</tbody></table></div>}{kind==="enrollment-logs"&&<p className="mt-3 text-sm text-muted-foreground">Enrollment creation records. Historical changes before this integration are not available.</p>}</MainLayout>;
}
