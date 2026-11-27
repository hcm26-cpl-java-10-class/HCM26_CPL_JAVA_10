import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { CourseCoverEditor } from "./CourseCoverEditor";
const ctx={fillRect:vi.fn(),beginPath:vi.fn(),arc:vi.fn(),fill:vi.fn(),fillText:vi.fn(),measureText:(text:string)=>({width:[...text].length*25})};
beforeEach(()=>{vi.clearAllMocks();vi.spyOn(HTMLCanvasElement.prototype,"getContext").mockReturnValue(ctx as never);vi.spyOn(HTMLCanvasElement.prototype,"toDataURL").mockReturnValue("data:image/png;base64,cHJldmlldw==");});
it("previews styles and variations without writes or replacing a selected cover",async()=>{
 const user=userEvent.setup();const onChange=vi.fn();render(<CourseCoverEditor value="https://example.test/original.jpg" form={{name:"Lập trình nâng cao",categoryIds:[2],level:"ADVANCED"}} categories={[{id:2,name:"Java",code:"JAVA"}]} onChange={onChange} disabled={false}/>);
 await user.click(screen.getByRole("button",{name:"Preview cover"}));expect(onChange).not.toHaveBeenCalled();
 expect(ctx.fillText).toHaveBeenCalledWith("Advanced",70,580);
 await user.selectOptions(screen.getByLabelText("Cover style"),"Grid");await user.click(screen.getByRole("button",{name:"Generate another variation"}));expect(onChange).not.toHaveBeenCalled();
 await user.click(screen.getByRole("button",{name:"Use this cover"}));expect(onChange).toHaveBeenCalledWith("coverImage","data:image/png;base64,cHJldmlldw==");
});
it("keeps the form and current cover after generation failure",async()=>{
 vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null);
 const onChange=vi.fn();render(<CourseCoverEditor value="https://example.test/original.jpg" form={{name:"Retained"}} categories={[]} onChange={onChange} disabled={false}/>);
 await userEvent.click(screen.getByRole("button",{name:"Preview cover"}));expect(screen.getByRole("alert")).toHaveTextContent("unavailable");expect(onChange).not.toHaveBeenCalled();expect(screen.getByRole("textbox")).toHaveValue("https://example.test/original.jpg");
});
