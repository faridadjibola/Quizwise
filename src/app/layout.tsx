import type { Metadata } from "next";import "./globals.css";
import { AuthProvider } from "./providers";
export const metadata:Metadata={title:"Quizwise — Learning in focus",description:"Take quizzes, review your results, and keep your progress in view."};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased"><AuthProvider>{children}</AuthProvider></body></html>}
