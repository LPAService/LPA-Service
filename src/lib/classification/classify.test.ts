import { describe, expect, it } from 'vitest';
import { classify } from './classify';
import categorias from './categories.json';
import regras from './rules.json';

const BASE_OBRIGATORIAS = [
  'eletronicos', 'informatica', 'material-de-escritorio', 'impressao-toner',
  'servicos', 'construcao', 'manutencao', 'eletrica', 'hidraulica', 'moveis',
  'utensilios', 'limpeza-higiene', 'alimentos', 'carnes', 'lacticinios',
  'frutas-e-verduras', 'congelados', 'nao-pereciveis', 'panificacao',
  'transporte', 'seguranca', 'uniformes-textil', 'outros'
];

describe('estrutura da taxonomia', () => {
  it('possui todas as categorias-base obrigatorias', () => {
    const slugs = (categorias as Array<{ slug: string }>).map((c) => c.slug);
    for (const b of BASE_OBRIGATORIAS) expect(slugs).toContain(b);
  });

  it('slugs sao unicos', () => {
    const slugs = (categorias as Array<{ slug: string }>).map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('regras tem ids unicos e apontam para categorias validas', () => {
    const slugs = new Set((categorias as Array<{ slug: string }>).map((c) => c.slug));
    const ids = (regras as Array<{ id: string; categoryId: string }>).map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of regras as Array<{ id: string; categoryId: string }>) {
      expect(slugs.has(r.categoryId), `regra ${r.id} -> categoria invalida`).toBe(true);
    }
  });

  it('toda categoria tem campos obrigatorios', () => {
    for (const c of categorias as Array<Record<string, unknown>>) {
      expect(c.slug).toBeTypeOf('string');
      expect(c.name).toBeTypeOf('string');
      expect(c.prioridade).toBeTypeOf('number');
      expect(Array.isArray(c.keywords)).toBe(true);
      expect(Array.isArray(c.keywords_negativas)).toBe(true);
      expect(Array.isArray(c.exemplos_itens)).toBe(true);
    }
  });
});

describe('regras determinísticas', () => {
  const casos: Array<[string, string]> = [
    ['aquisição de gêneros alimentícios perecíveis', 'frutas-e-verduras'],
    ['contratação de empresa especializada em manutenção predial preventiva', 'manutencao'],
    ['aquisição de cartuchos e toners para impressora', 'impressao-toner'],
    ['aquisição de material de expediente', 'material-de-escritorio'],
    ['fornecimento de toner original para impressora laser hp', 'impressao-toner'],
    ['aquisição de material de limpeza escolar', 'limpeza-higiene'],
    ['compra de material de escritório', 'material-de-escritorio'],
    ['contratação de empresa de vigilância patrimonial', 'seguranca'],
    ['aquisição de gêneros alimentícios para merenda escolar', 'alimentos'],
    ['fornecimento de carne bovina e frango', 'carnes'],
    ['aquisição de leite e derivados', 'lacticinios'],
    ['compra de frutas e verduras para a cozinha', 'frutas-e-verduras'],
    ['aquisição de pães e bolos para a escola', 'panificacao'],
    ['fornecimento de arroz, feijão e óleo de soja', 'nao-pereciveis'],
    ['aquisição de gêneros alimentícios congelados', 'congelados'],
    ['contratação de empresa para transporte escolar', 'transporte'],
    ['compra de uniformes e fardamento', 'uniformes-textil'],
    ['aquisição de material elétrico para manutenção', 'eletrica'],
    ['compra de material hidráulico', 'hidraulica'],
    ['aquisição de material de construção civil', 'construcao'],
    ['Obras', 'construcao'],
    ['contratação de empresa especializada em instalação elétrica', 'eletrica'],
    ['serviço de manutenção hidráulica', 'hidraulica'],
    ['aquisição de computadores e notebooks', 'informatica'],
    ['Equipamentos Tecnológicos', 'informatica'],
    ['compra de televisores para a escola', 'eletronicos'],
    ['aquisição de mobiliário escolar', 'moveis'],
    ['compra de panelas e talheres para a cozinha', 'utensilios'],
    ['contratação de empresa de dedetização', 'servicos'],
    ['fornecimento de pão francês', 'panificacao'],
    ['aquisição de material de expediente e papelaria', 'material-de-escritorio'],
    ['compra de lâmpadas LED para iluminação', 'eletrica'],
    ['aquisição de extintores e recarga', 'seguranca'],
    ['Conservação e pequenos reparos', 'manutencao'],
    ['Manutenção e Reformas', 'manutencao'],
    ['fornecimento de sabão em pó para lavanderia', 'limpeza-higiene'],
    ['aquisição de material didático para os alunos', 'material-de-escritorio'],
    ['Material Pedagógico', 'material-pedagogico'],
    ['compra de giz e apagador para lousa', 'material-de-escritorio'],
    ['aquisição de mochilas e estojos para os alunos', 'material-de-escritorio'],
    ['fornecimento de detergente e desinfetante', 'limpeza-higiene'],
    ['aquisição de papel sulfite A4', 'material-de-escritorio'],
    ['compra de papel higiênico', 'limpeza-higiene'],
    ['tinta para impressora', 'impressao-toner'],
    ['tinta látex para pintura da escola', 'construcao'],
    ['manutenção de computadores', 'informatica'],
    ['manutenção predial preventiva', 'manutencao'],
    ['cabo de rede para laboratório de informática', 'informatica'],
    ['aquisição de frango congelado', 'congelados'],
    ['compra de carne congelada', 'congelados'],
    ['aquisição de computador e impressora', 'informatica'],
    ['serviço de manutenção de ar condicionado', 'manutencao'],
    ['compra de ar condicionado split', 'eletronicos'],
    ['contratação de empresa de limpeza de caixa d\'água', 'limpeza-higiene'],
    ['compra de tomadas e interruptores', 'eletrica'],
    ['aquisição de torneiras e válvulas', 'hidraulica'],
    ['vassouras e panos de chão', 'limpeza-higiene'],
    ['serviço de limpeza de fossa séptica da escola', 'servicos'],
    ['álcool 70% e água sanitária', 'limpeza-higiene'],
    ['aquisição de extintores e mangueiras de incêndio', 'seguranca'],
    ['fornecimento de papel sulfite e canetas', 'material-de-escritorio'],
    ['Serviços Operacionais Contínuos', 'servicos'],
    ['Serviço de Transporte Contínuo', 'transporte'],
    ['Material de Consumo Geral', 'material-de-consumo-geral']
  ];

  for (const [texto, esperado] of casos) {
    it(`classifica: "${texto}"`, () => {
      const r = classify(texto);
      expect(r.categoryId).toBe(esperado);
      expect(r.needsFallback).toBe(false);
      expect(r.matchedRules.some((m) => m.startsWith('regra:'))).toBe(true);
    });
  }
});

describe('keyword matching (sem regra) e singularização', () => {
  it('mesas e cadeiras para sala de aula -> moveis (keyword)', () => {
    const r = classify('aquisição de mesas e cadeiras para sala de aula');
    expect(r.categoryId).toBe('moveis');
    expect(r.matchedRules).toContain('keyword:moveis');
    expect(r.needsFallback).toBe(false);
  });

  it('caixa de som e microfone -> eletronicos (keyword)', () => {
    const r = classify('aquisição de caixa de som e microfone para eventos');
    expect(r.categoryId).toBe('eletronicos');
    expect(r.matchedRules).toContain('keyword:eletronicos');
  });

  it('fones de ouvido e webcams -> informatica (keyword)', () => {
    const r = classify('aquisição de fones de ouvido e webcams para o laboratório');
    expect(r.categoryId).toBe('informatica');
  });

  it('manutenção e reparo de bebedouros -> manutencao (keyword)', () => {
    const r = classify('serviço de manutenção e reparo de bebedouros');
    expect(r.categoryId).toBe('manutencao');
    expect(r.matchedRules).toContain('keyword:manutencao');
  });

  it('TEXTOS EM MAIÚSCULO são normalizados', () => {
    const r = classify('AQUISIÇÃO DE TONERS E CARTUCHOS');
    expect(r.categoryId).toBe('impressao-toner');
  });

  it('plural irregular pães -> pao', () => {
    const r = classify('fornecimento de pães');
    expect(r.categoryId).toBe('panificacao');
  });

  it('itens array é concatenado ao texto', () => {
    const r = classify('objeto: aquisição de gêneros alimentícios', [
      'LEITE INTEGRAL 1L',
      'QUEIJO MUSSARELA',
      'MANTEIGA'
    ]);
    expect(r.categoryId).toBe('lacticinios');
  });
});

describe('score semântico simples (overlap de vocabulário)', () => {
  it('melancia, mamão e abacaxi -> frutas-e-verduras (semantico)', () => {
    const r = classify('fornecimento de melancia, mamão e abacaxi para a merenda');
    expect(r.categoryId).toBe('frutas-e-verduras');
    expect(r.matchedRules).toContain('semantico:frutas-e-verduras');
  });

  it('tangerina e mamão -> frutas-e-verduras (semantico)', () => {
    const r = classify('aquisição de tangerina e mamão');
    expect(r.categoryId).toBe('frutas-e-verduras');
  });

  it('couve-flor, brócolis e abóbora -> frutas-e-verduras (semantico)', () => {
    const r = classify('compra de couve-flor, brócolis e abóbora');
    expect(r.categoryId).toBe('frutas-e-verduras');
    expect(r.needsFallback).toBe(false);
  });
});

describe('casos ambíguos desempatados', () => {
  it('material de limpeza escolar != material de escritório', () => {
    expect(classify('material de limpeza escolar').categoryId).toBe('limpeza-higiene');
    expect(classify('material de escritório').categoryId).toBe('material-de-escritorio');
  });

  it('papel higiênico != papel sulfite', () => {
    expect(classify('papel higiênico').categoryId).toBe('limpeza-higiene');
    expect(classify('papel sulfite').categoryId).toBe('material-de-escritorio');
  });

  it('tinta para impressora != tinta látex', () => {
    expect(classify('tinta para impressora').categoryId).toBe('impressao-toner');
    expect(classify('tinta látex').categoryId).toBe('construcao');
  });

  it('gêneros alimentícios perecíveis != gêneros alimentícios', () => {
    expect(classify('gêneros alimentícios perecíveis').categoryId).toBe('frutas-e-verduras');
    expect(classify('gêneros alimentícios').categoryId).toBe('alimentos');
  });

  it('frango congelado -> congelados, carne fresca -> carnes', () => {
    expect(classify('frango congelado').categoryId).toBe('congelados');
    expect(classify('carne bovina fresca').categoryId).toBe('carnes');
  });

  it('manutenção elétrica é serviço de elétrica, não manutenção genérica', () => {
    expect(classify('manutenção elétrica').categoryId).toBe('eletrica');
  });

  it('registro de preços não dispara hidráulica', () => {
    const r = classify('ata de registro de preços para aquisição de itens diversos');
    expect(r.categoryId).not.toBe('hidraulica');
  });

  it('grupos reais genericos nao roubam material eletrico especifico', () => {
    expect(classify('Obras material elétrico').categoryId).toBe('eletrica');
  });

  it('grupo tecnologico nao rouba seguranca especifica', () => {
    expect(classify('Equipamentos Tecnológicos câmera de segurança').categoryId).toBe('seguranca');
  });

  it('grupo pedagogico nao rouba papelaria especifica', () => {
    expect(classify('Material Pedagógico papel sulfite').categoryId).toBe('material-de-escritorio');
  });

  it('grupo transporte continuo nao rouba informatica especifica', () => {
    expect(classify('Serviço de Transporte Contínuo manutenção de computadores').categoryId).toBe('informatica');
  });
});

describe('needsFallback = true (fora do alcance determinístico)', () => {
  const casos: Array<[string, string]> = [
    ['aquisição de instrumentos musicais para fanfarra escolar', ''],
    ['compra de brinquedos educativos para o parquinho', ''],
    ['serviços de tecnologia assistiva e acessibilidade', ''],
    ['aquisição de cadeiras de rodas e andadores', ''],
    ['', ''],
    ['prestação de serviços de decoração de festas infantis', ''],
    ['fornecimento de gás de cozinha (GLP)', ''],
    ['aquisição de material permanente para a cozinha', '']
  ];

  for (const [texto] of casos) {
    it(`fallback: "${texto}"`, () => {
      const r = classify(texto);
      expect(r.needsFallback).toBe(true);
      expect(r.categoryId).toBe('outros');
      expect(r.confidence).toBeLessThan(0.5);
      expect(r.matchedRules).toContain('fallback');
    });
  }
});
