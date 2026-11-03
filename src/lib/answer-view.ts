export type AnswerView={maximized:boolean;normalScrollTop:number;restoreScrollTop:number};
// Keep normal-layout reading position even if the larger viewport clamps scrollTop.
export function toggleAnswerView(view:AnswerView,scrollTop:number):AnswerView{
 return view.maximized?{maximized:false,normalScrollTop:view.normalScrollTop,restoreScrollTop:view.normalScrollTop}:{maximized:true,normalScrollTop:scrollTop,restoreScrollTop:scrollTop};
}
export function restoreAnswerOnEscape(event:{key:string;defaultPrevented:boolean},maximized:boolean){
 return maximized&&event.key==='Escape'&&!event.defaultPrevented;
}
