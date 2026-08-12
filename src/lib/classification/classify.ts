import categoriasRaw from './categories.json';
import regrasRaw from './rules.json';

export interface Categoria {
  slug: string;
  name: string;
  parent: string | null;
  keywords: string[];
  keywords_negativas: string[];
  exemplos_itens: string[];
  prioridade: number;
}

export interface Regra {
  id: string;
  name: string;
  categoryId: string;
  pattern: string | string[];
  negacoes?: string[];
  weight: number;
  priority: number;
}

export interface Classificacao {
  categoryId: string;
  candidateCategoryId?: string;
  confidence: number;
  matchedRules: string[];
  needsFallback: boolean;
}

const categorias: Categoria[] = categoriasRaw as unknown as Categoria[];
const regras: Regra[] = regrasRaw as unknown as Regra[];

const STOPWORDS = new Set([
  'a', 'ao', 'aos', 'as', 'ate', 'atras', 'com', 'como', 'da', 'das', 'de', 'do',
  'dos', 'e', 'em', 'entre', 'era', 'essa', 'essas', 'esse', 'esses', 'esta',
  'estas', 'este', 'estes', 'foi', 'ha', 'isso', 'isto', 'ja', 'mais', 'mas',
  'na', 'nas', 'no', 'nos', 'o', 'os', 'ou', 'para', 'pela', 'pelas', 'pelo',
  'pelos', 'por', 'qual', 'quando', 'que', 'se', 'sem', 'ser', 'sua', 'suas',
  'seu', 'seus', 'sobre', 'sob', 'tambem', 'um', 'uma', 'umas', 'uns', 'apos',
  'durante', 'onde', 'cada', 'bem', 'ate'
]);

export function removerAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function singularizar(palavra: string): string {
  if (palavra.length <= 3) return palavra;
  if (/oes$/.test(palavra)) return palavra.slice(0, -3) + 'ao';
  if (/aes$/.test(palavra)) return palavra.slice(0, -3) + 'ao';
  if (/ais$/.test(palavra)) return palavra.slice(0, -3) + 'al';
  if (/eis$/.test(palavra)) return palavra.slice(0, -3) + 'el';
  if (/ois$/.test(palavra)) return palavra.slice(0, -3) + 'ol';
  if (/ens$/.test(palavra)) return palavra.slice(0, -3) + 'em';
  if (/ares$/.test(palavra)) return palavra.slice(0, -2);
  if (/ores$/.test(palavra)) return palavra.slice(0, -2);
  if (/es$/.test(palavra)) return palavra.slice(0, -2) + 'e';
  if (/as$/.test(palavra)) return palavra.slice(0, -2) + 'a';
  if (/os$/.test(palavra)) return palavra.slice(0, -2) + 'o';
  if (/is$/.test(palavra) || /us$/.test(palavra)) return palavra;
  if (/s$/.test(palavra)) return palavra.slice(0, -1);
  return palavra;
}

export function normalizar(texto: string): string {
  const s = removerAcentos(texto.toLowerCase()).replace(/[^a-z0-9]+/g, ' ').trim();
  return s.split(/\s+/).map(singularizar).join(' ');
}

export function tokensDe(texto: string): string[] {
  return normalizar(texto)
    .split(/\s+/)
    .filter((t) => t.length > 0 && !STOPWORDS.has(t) && !/^\d+$/.test(t));
}

function matchPalavra(chave: string, textoNorm: string, tokens: Set<string>): boolean {
  const k = normalizar(chave).trim();
  if (k.includes(' ')) return textoNorm.includes(k);
  if (tokens.has(k)) return true;
  if (k.length >= 5) {
    for (const t of tokens) {
      if (t.length > k.length && t.startsWith(k)) return true;
    }
  }
  return false;
}

function pontuarCategoria(
  cat: Categoria,
  textoNorm: string,
  tokens: Set<string>
): { count: number; negado: boolean; negativa: string | null } {
  let count = 0;
  for (const kw of cat.keywords) {
    if (matchPalavra(kw, textoNorm, tokens)) count++;
  }
  for (const neg of cat.keywords_negativas) {
    if (matchPalavra(neg, textoNorm, tokens)) return { count, negado: true, negativa: neg };
  }
  return { count, negado: false, negativa: null };
}

const vocabCache = new Map<string, Set<string>>();

const STOPVOCAB = new Set([
  'escola', 'escolar', 'aluno', 'alunos', 'item', 'itens', 'material', 'materiais',
  'servico', 'servicos', 'aquisicao', 'fornecimento', 'compra', 'produto',
  'produtos', 'unidade', 'unidades', 'objeto', 'diverso', 'diversos',
  'prestacao', 'geral', 'contratacao', 'empresa', 'variado', 'variados',
  'dependencia', 'dependencias', 'interna', 'local'
]);

function vocabDe(cat: Categoria): Set<string> {
  const cache = vocabCache.get(cat.slug);
  if (cache) return cache;
  const v = new Set<string>();
  const add = (s: string) =>
    tokensDe(s).forEach((t) => {
      if (!STOPVOCAB.has(t)) v.add(t);
    });
  cat.keywords.forEach(add);
  cat.exemplos_itens.forEach(add);
  add(cat.name);
  vocabCache.set(cat.slug, v);
  return v;
}

function overlapSemantico(cat: Categoria, tokens: string[]): number {
  const v = vocabDe(cat);
  let n = 0;
  for (const t of tokens) {
    if (STOPVOCAB.has(t)) continue;
    if (v.has(t)) n++;
  }
  return n;
}

function regraAtiva(regra: Regra, textoNorm: string): boolean {
  const padroes = Array.isArray(regra.pattern) ? regra.pattern : [regra.pattern];
  const match = padroes.some((p) => new RegExp(p).test(textoNorm));
  if (!match) return false;
  const negacoes = regra.negacoes ?? [];
  return !negacoes.some((p) => new RegExp(p).test(textoNorm));
}

export function classify(texto: string, itens: string[] = []): Classificacao {
  const fonte = [texto, ...(itens ?? [])]
    .filter((s) => typeof s === 'string' && s.trim().length > 0)
    .join(' ');

  if (!fonte.trim()) {
    return { categoryId: 'outros', confidence: 0, matchedRules: ['fallback'], needsFallback: true };
  }

  const textoNorm = normalizar(fonte);
  const tokens = tokensDe(fonte);
  const tokenSet = new Set(tokens);

  const ordenadas = [...regras].sort(
    (a, b) => b.priority - a.priority || a.id.localeCompare(b.id)
  );

  for (const regra of ordenadas) {
    if (regraAtiva(regra, textoNorm)) {
      return {
        categoryId: regra.categoryId,
        confidence: regra.weight,
        matchedRules: [`regra:${regra.id}`],
        needsFallback: false
      };
    }
  }

  let melhor: Categoria | null = null;
  let melhorCount = 0;
  for (const cat of categorias) {
    if (cat.slug === 'outros') continue;
    const { count, negado } = pontuarCategoria(cat, textoNorm, tokenSet);
    if (negado || count < 2) continue;
    if (count > melhorCount || (count === melhorCount && cat.prioridade > (melhor?.prioridade ?? -1))) {
      melhor = cat;
      melhorCount = count;
    }
  }
  if (melhor) {
    return {
      categoryId: melhor.slug,
      confidence: Math.min(1, 0.45 + 0.15 * melhorCount),
      matchedRules: [`keyword:${melhor.slug}`],
      needsFallback: false
    };
  }

  let melhorSem: Categoria | null = null;
  let melhorOv = 0;
  for (const cat of categorias) {
    if (cat.slug === 'outros') continue;
    const ov = overlapSemantico(cat, tokens);
    if (ov > melhorOv || (ov === melhorOv && cat.prioridade > (melhorSem?.prioridade ?? -1))) {
      melhorSem = cat;
      melhorOv = ov;
    }
  }
  if (melhorSem && melhorOv >= 2) {
    return {
      categoryId: melhorSem.slug,
      confidence: Math.min(1, 0.35 + 0.15 * melhorOv),
      matchedRules: [`semantico:${melhorSem.slug}`],
      needsFallback: false
    };
  }
  if (melhorSem && melhorOv >= 1) {
    return {
      categoryId: 'outros',
      candidateCategoryId: melhorSem.slug,
      confidence: 0.1,
      matchedRules: ['fallback'],
      needsFallback: true
    };
  }
  return {
    categoryId: 'outros',
    confidence: 0,
    matchedRules: ['fallback'],
    needsFallback: true
  };
}
