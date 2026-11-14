import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "云端开发环境全景透视工作台 · Z.ai 沙箱",
  description:
    "实时遥测 Cockpit、真实云端终端、进程监视、工作区文件树、算力基准测试与 Agent 行动直播 —— 基于 Gemini 原版 cloud-sandbox-explorer 的 Next.js 16 沙箱适配版。",
  keywords: ["云沙箱", "终端", "遥测", "Agent 行动直播", "Next.js", "Linux"],
  authors: [{ name: "Z.ai Agent × Gemini" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
