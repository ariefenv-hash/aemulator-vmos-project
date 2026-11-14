'use client';

import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';
import { TERMINAL_FAQS } from './capabilitiesData';

export const FaqSection: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
          <HelpCircle className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-bold text-white text-base">终端能力常见问答 (Terminal FAQ)</h3>
          <p className="text-xs text-slate-400">关于本沙箱环境隔离、依赖安装、网络权限与 Agent 协作的常见疑问</p>
        </div>
      </div>

      <div className="space-y-3">
        {TERMINAL_FAQS.map((faq, idx) => {
          const isOpen = openIndex === idx;
          return (
            <div
              key={faq.question}
              className="bg-slate-950/70 border border-slate-800/80 rounded-xl overflow-hidden transition-all"
            >
              <button
                onClick={() => toggle(idx)}
                className="w-full px-4 py-3 text-left flex items-center justify-between gap-2 text-sm font-medium text-slate-200 hover:text-white hover:bg-slate-900/50 transition cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0" />
                  {faq.question}
                </span>
                {isOpen ? (
                  <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                )}
              </button>

              {isOpen && (
                <div className="px-4 pb-4 pt-3 text-xs text-slate-300 leading-relaxed border-t border-slate-800/50 bg-black/20">
                  {faq.answer}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
