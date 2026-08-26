import React from 'react';

// Renderizador de markdown LEVE e seguro (sem dependência, sem dangerouslySetInnerHTML).
// Cobre o que a IA costuma devolver: **negrito**, títulos #/##/###, listas "-"/"*" e "1.",
// parágrafos e quebras de linha. Nada de HTML cru — tudo vira elemento React.

function renderInline(text: string): React.ReactNode[] {
  // Divide em pedaços de **negrito** mantendo o resto como texto.
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={i} className="font-bold">{p.slice(2, -2)}</strong>;
    return <React.Fragment key={i}>{p}</React.Fragment>;
  });
}

export const Markdown: React.FC<{ text: string }> = ({ text }) => {
  const lines = (text || '').replace(/\r/g, '').split('\n');
  const blocks: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushList = () => {
    if (!list) return;
    const items = list.items;
    if (list.ordered) {
      blocks.push(
        <ol key={`b${blocks.length}`} className="space-y-1 my-1">
          {items.map((it, i) => (
            <li key={i} className="flex gap-2">
              <span className="shrink-0 font-bold text-primary/80">{i + 1}.</span>
              <span>{renderInline(it)}</span>
            </li>
          ))}
        </ol>
      );
    } else {
      blocks.push(
        <ul key={`b${blocks.length}`} className="space-y-1 my-1">
          {items.map((it, i) => (
            <li key={i} className="flex gap-2">
              <span className="shrink-0 text-primary/70 mt-1.5 h-1 w-1 rounded-full bg-current" />
              <span>{renderInline(it)}</span>
            </li>
          ))}
        </ul>
      );
    }
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trim(); // trima também o recuo → bullets aninhados ainda viram bullets
    if (!line) { flushList(); continue; }

    const h = line.match(/^(#{1,6})\s+(.*)$/);
    const bullet = line.match(/^[-*]\s+(.*)$/);
    const num = line.match(/^\d+\.\s+(.*)$/);

    if (h) {
      flushList();
      blocks.push(<p key={`b${blocks.length}`} className="font-black text-[13px] tracking-tight mt-1.5">{renderInline(h[2])}</p>);
    } else if (bullet) {
      if (!list || list.ordered) { flushList(); list = { ordered: false, items: [] }; }
      list.items.push(bullet[1]);
    } else if (num) {
      if (!list || !list.ordered) { flushList(); list = { ordered: true, items: [] }; }
      list.items.push(num[1]);
    } else {
      flushList();
      blocks.push(<p key={`b${blocks.length}`}>{renderInline(line)}</p>);
    }
  }
  flushList();

  return <div className="space-y-1.5 leading-relaxed">{blocks}</div>;
};
