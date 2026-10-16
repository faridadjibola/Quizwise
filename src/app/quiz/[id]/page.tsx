import Runner from "./runner";export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <Runner id={id}/>}
