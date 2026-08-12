import type {
  NormalizedOpportunity,
  OpportunityItem
} from "@/lib/contracts/opportunity";

export type OpportunityFilters = {
  city?: string;
  category?: string;
  expenseGroup?: string;
  school?: string;
  periodStart?: string;
  periodEnd?: string;
  query?: string;
};

export type OpportunityPage = {
  page: number;
  pageSize: number;
};

export type OpportunityListResult = {
  data: NormalizedOpportunity[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  facets: {
    cities: string[];
    categories: string[];
    expenseGroups: string[];
    schools: string[];
  };
};

export interface OpportunitySource {
  listOpportunities(
    filters?: OpportunityFilters,
    page?: Partial<OpportunityPage>
  ): Promise<OpportunityListResult>;
  getOpportunity(externalId: string): Promise<NormalizedOpportunity | null>;
}

type SeedOrder = {
  orderId: string;
  year: string;
  school: string;
  city: string;
  regional: string;
  subprogram: string;
  expenseGroup: string;
  purchaseDate: string;
  idSubprogram: number;
  idSchool: number;
  idBudget: number;
  idSupplier: number;
  supplierName: string;
  supplierDocument: string;
  deliveryDate: string;
  proposalDate: string;
};

type SeedOrderTuple = [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  number,
  number,
  number,
  number,
  string,
  string,
  string,
  string
];

const SOURCE_BASE_URL = "https://caixaescolar.educacao.mg.gov.br";

const categoryByGroup: Record<string, { slug: string; name: string }> = {
  "Gêneros Alimentícios": { slug: "alimentos", name: "Alimentos" },
  "Manutenção e Reformas": { slug: "manutencao", name: "Manutenção predial" },
  "Conservação e pequenos reparos": {
    slug: "reparos",
    name: "Reparos e conservação"
  },
  "Projetos Pedagógicos e Atividades Educacionais": {
    slug: "pedagogico",
    name: "Projetos pedagógicos"
  },
  "Serviços Operacionais Contínuos": {
    slug: "servicos-operacionais",
    name: "Serviços operacionais"
  },
  "Equipamentos de Segurança": {
    slug: "seguranca",
    name: "Segurança eletrônica"
  },
  "Material de Consumo Geral": {
    slug: "consumo",
    name: "Material de consumo"
  },
  "Gás recarga": { slug: "gas", name: "Gás de cozinha" },
  "Mobiliários Administrativos": {
    slug: "mobiliario",
    name: "Mobiliário administrativo"
  }
};

const templates: Record<string, OpportunityItem[]> = {
  alimentos: [
    item(1, "Arroz", "Arroz agulhinha tipo 1 em pacote de 5 kg.", "Pacote", 160, 19.29),
    item(2, "Feijão carioca", "Feijão carioca tipo 1 para merenda escolar.", "KG", 120, 8.7),
    item(3, "Macarrão", "Macarrão sêmola pacote 500 g.", "Pacote", 180, 4.8),
    item(4, "Banana", "Banana prata in natura para alimentação escolar.", "KG", 240, 5.9),
    item(5, "Tomate", "Tomate de mesa fresco, sem avarias.", "KG", 130, 6.4),
    item(6, "Cenoura", "Cenoura fresca lavada, tamanho médio.", "KG", 80, 4.7)
  ],
  panificacao: [
    item(
      1,
      "Pão de sal",
      "Pão de sal tipo francês, fresco, produzido no dia da entrega.",
      "KG",
      200,
      25
    )
  ],
  carnes: [
    item(1, "Carne bovina", "Carne bovina resfriada para preparo de refeições.", "KG", 90, 38.4),
    item(2, "Frango", "Coxa e sobrecoxa de frango congelada.", "KG", 140, 13.8),
    item(3, "Linguiça", "Linguiça suína resfriada em embalagem própria.", "KG", 55, 21.2)
  ],
  hortifruti: [
    item(1, "Banana", "Banana prata em penca, grau adequado de maturação.", "KG", 190, 5.75),
    item(2, "Tomate", "Tomate longa vida fresco.", "KG", 120, 6.2),
    item(3, "Batata", "Batata inglesa lavada.", "KG", 160, 4.95),
    item(4, "Cenoura", "Cenoura extra tamanho médio.", "KG", 85, 4.6),
    item(5, "Alface", "Alface crespa em maço, folhas íntegras.", "Maço", 110, 3.1)
  ],
  manutencao: [
    item(1, "Telha cerâmica romana", "Telha romana cerâmica natural resinada, primeira linha.", "Unidade", 100, 6.95),
    item(2, "Tinta acrílica", "Tinta acrílica premium para áreas internas e externas.", "Lata", 18, 142.5),
    item(3, "Reparo hidráulico", "Serviço de correção em torneiras, registros e sifões.", "Serviço", 1, 2850),
    item(4, "Luminária LED", "Luminária LED sobrepor para salas e corredores.", "Unidade", 32, 78.9)
  ],
  reparos: [
    item(1, "Limpeza de calhas", "Limpeza de telhados, calhas, ralos e condutores.", "Serviço", 1, 1800),
    item(2, "Troca de fechaduras", "Substituição de fechaduras e trincos danificados.", "Unidade", 18, 95),
    item(3, "Reparo de muro", "Reparo pontual em muro sem alteração estrutural.", "Serviço", 1, 2600)
  ],
  pedagogico: [
    item(1, "Transporte escolar", "Transporte para atividade pedagógica externa.", "Serviço", 1, 3200),
    item(2, "Material pedagógico", "Kits de apoio para oficina educacional.", "Kit", 45, 58.9),
    item(3, "Banner educativo", "Banner em lona para atividade escolar.", "Unidade", 12, 86)
  ],
  "servicos-operacionais": [
    item(1, "Dedetização", "Controle de pragas em áreas internas e externas.", "Serviço", 1, 1650),
    item(2, "Limpeza de caixa d'água", "Higienização de reservatórios de água potável.", "Serviço", 2, 740),
    item(3, "Internet", "Serviço de conectividade para secretaria e laboratórios.", "Mês", 12, 189.9)
  ],
  seguranca: [
    item(1, "Câmera IP", "Câmera IP full HD para monitoramento escolar.", "Unidade", 16, 245),
    item(2, "DVR", "Gravador digital para circuito de segurança.", "Unidade", 1, 1490),
    item(3, "Sensor de presença", "Sensor infravermelho para alarme patrimonial.", "Unidade", 12, 89)
  ],
  consumo: [
    item(1, "Papel A4", "Papel sulfite A4 branco para uso administrativo.", "Resma", 120, 24.9),
    item(2, "Álcool 70%", "Álcool líquido 70% para limpeza geral.", "Litro", 90, 8.4),
    item(3, "Saco de lixo", "Saco de lixo reforçado 100 litros.", "Pacote", 80, 14.7),
    item(4, "Caneta esferográfica", "Caneta azul para rotina administrativa.", "Caixa", 22, 38.5)
  ],
  gas: [
    item(1, "Gás GLP P13", "Recarga de gás liquefeito de petróleo para cozinha escolar.", "Botijão", 18, 112)
  ],
  mobiliario: [
    item(1, "Mesa de escritório", "Mesa reta com tampo em MDP para secretaria.", "Unidade", 8, 430),
    item(2, "Cadeira fixa", "Cadeira fixa estofada para atendimento.", "Unidade", 24, 165),
    item(3, "Armário baixo", "Armário baixo com duas portas e chave.", "Unidade", 5, 615)
  ]
};

const orderRows: SeedOrderTuple[] = [
  ["2027075592", "2027", "EE CORONEL ARISTIDES BATISTA", "Montes Claros", "SRE/MONTES CLAROS", "Subprograma - Alimentação Federal 2026", "Gêneros Alimentícios", "2026-08-10T20:44:01.883Z", 1396, 9458, 338067, 45217, "PADARIA E MERCEARIA SOUTO E MACEDO LTDA", "07.571.867/0001-46", "2026-09-02T19:06:11.000Z", "2026-08-04T19:06:11.000Z"],
  ["2027075587", "2027", "EE AFONSO ROMAO DE SIQUEIRA", "Pirapora", "SRE/PIRAPORA", "Subprograma - Manutenção Escolar e Desenvolvimento do Ensino 2026", "Manutenção e Reformas", "2026-08-06T13:38:35.401Z", 717, 9926, 335900, 95060, "rangel de souza", "38.165.412/0001-54", "2026-08-09T08:26:12.000Z", "2026-08-04T08:26:12.000Z"],
  ["2027075586", "2027", "EE RAUL SOARES", "Araguari", "SRE/UBERLANDIA", "Subprograma - Alimentação Estadual 2026", "Gêneros Alimentícios", "2026-08-10T09:28:35.012Z", 635, 10415, 333464, 81946, "GUTEMBERG PIAS DOS SANTOS", "64.987.058/0001-53", "2026-12-31T06:09:10.000Z", "2026-08-09T06:09:10.000Z"],
  ["2027075584", "2027", "EE PADRE CAMARGOS", "Belo Horizonte", "SRE/METROPOLITANA A", "Subprograma - Alimentação Federal 2026", "Gêneros Alimentícios", "2026-08-03T16:28:56.383Z", 1377, 8353, 332652, 42153, "Regina Thielle Soares Espindola Ltda", "41.253.000/0001-00", "2026-09-12T12:00:00.000Z", "2026-08-02T12:00:00.000Z"],
  ["2027075582", "2027", "EE DE CONEGO MARINHO", "Cônego Marinho", "SRE/JANUARIA", "Subprograma - Manutenção Escolar e Desenvolvimento do Ensino 2026", "Conservação e pequenos reparos", "2026-07-26T10:43:22.571Z", 691, 9170, 327383, 51810, "Emerson Alves de moura LTDA", "18.510.000/0001-00", "2026-08-20T10:00:00.000Z", "2026-07-25T10:00:00.000Z"],
  ["2027075581", "2027", "EE LUIZ SALGADO LIMA", "Janaúba", "SRE/JANAUBA", "Subprograma - Alimentação Estadual 2026", "Gêneros Alimentícios", "2026-07-27T12:06:43.893Z", 652, 9673, 326958, 60842, "COMERCIAL P&L LTDA", "60.842.000/0001-00", "2026-09-05T12:00:00.000Z", "2026-07-26T12:00:00.000Z"],
  ["2027075580", "2027", "EE SINFRONIO BONFIM", "Salinas", "SRE/SALINAS", "Subprograma - Alimentação Federal 2026", "Gêneros Alimentícios", "2026-07-27T11:53:06.051Z", 1383, 8602, 325409, 55229, "MERCEARIA AVENIDA LTDA", "55.229.000/0001-00", "2026-09-04T11:00:00.000Z", "2026-07-26T11:00:00.000Z"],
  ["2027075579", "2027", "EE JOSE GOMES PIMENTEL", "Buritis", "SRE/PARACATU", "Subprograma - Alimentação Estadual 2026", "Gêneros Alimentícios", "2026-07-14T15:15:42.026Z", 629, 9784, 319404, 55182, "BURITIS ATACADO VAREJO E DISTRIBUICAO EIRELI", "55.182.000/0001-00", "2026-08-30T15:00:00.000Z", "2026-07-12T15:00:00.000Z"],
  ["2027075578", "2027", "EE JUCA MARIA", "Montes Claros", "SRE/MONTES CLAROS", "Subprograma - Alimentação Estadual 2026", "Gêneros Alimentícios", "2026-07-14T10:45:29.164Z", 633, 9456, 318169, 70648, "RR SOLUÇÕES E EMPREENDIMENTOS LTDA", "70.648.000/0001-00", "2026-08-28T10:00:00.000Z", "2026-07-12T10:00:00.000Z"],
  ["2027075576", "2027", "EE PRESIDENTE TANCREDO NEVES", "Uberlândia", "SRE/UBERLANDIA", "Subprograma - Demandas Pedagógicas Excepcionais 2026", "Projetos Pedagógicos e Atividades Educacionais", "2026-07-10T13:49:45.746Z", 1463, 9613, 317926, 76087, "TRANSMATHEUS TURISMO LTDA", "76.087.000/0001-00", "2026-08-18T13:00:00.000Z", "2026-07-09T13:00:00.000Z"],
  ["2027075575", "2027", "EE PROFESSORA ELISA TEIXEIRA DE CARVALHO", "Contagem", "SRE/METROPOLITANA B", "Subprograma - Manutenção Escolar e Desenvolvimento do Ensino 2026", "Serviços Operacionais Contínuos", "2026-07-08T13:20:27.606Z", 712, 9413, 317743, 45438, "PH Master Service Informática Ltda.", "45.438.000/0001-00", "2026-08-16T13:00:00.000Z", "2026-07-07T13:00:00.000Z"],
  ["2027075574", "2027", "EE JOSE LOURENCO DE FREITAS", "Unaí", "SRE/PARACATU", "Subprograma - Alimentação Federal 2026", "Gêneros Alimentícios", "2026-07-06T11:28:00.747Z", 1407, 10025, 311808, 62677, "Supermercado Vilela Khouri e El Hadj Ltda", "62.677.000/0001-00", "2026-08-15T11:00:00.000Z", "2026-07-05T11:00:00.000Z"],
  ["2027075573", "2027", "EE CORONEL ARISTIDES BATISTA", "Montes Claros", "SRE/MONTES CLAROS", "Subprograma - Alimentação Federal 2026", "Gêneros Alimentícios", "2026-06-25T17:44:21.882Z", 1396, 9458, 310271, 44953, "Açougue do son ltda", "44.953.000/0001-00", "2026-08-08T17:00:00.000Z", "2026-06-24T17:00:00.000Z"],
  ["2027075572", "2027", "EE JOVIANO NAVES", "Uberaba", "SRE/UBERABA", "Subprograma - Demandas Pedagógicas Excepcionais 2026", "Gêneros Alimentícios", "2026-06-25T14:36:52.121Z", 1468, 10691, 310061, 51392, "Mercearia Todo Dia Ltda", "51.392.000/0001-00", "2026-08-06T14:00:00.000Z", "2026-06-24T14:00:00.000Z"],
  ["2027075571", "2027", "EE JOAO XXIII", "Juiz de Fora", "SRE/JUIZ DE FORA", "Subprograma - Manutenção Escolar e Desenvolvimento do Ensino 2026", "Equipamentos de Segurança", "2026-06-19T14:21:07.427Z", 722, 9750, 309105, 45423, "ALARMON SEGURANÇA ELETRONICA EIRELI", "45.423.000/0001-00", "2026-08-01T14:00:00.000Z", "2026-06-18T14:00:00.000Z"],
  ["2027075568", "2027", "EE ERNESTO BARBOSA", "Poços de Caldas", "SRE/POCOS DE CALDAS", "Subprograma - Manutenção Escolar e Desenvolvimento do Ensino 2026", "Material de Consumo Geral", "2026-06-11T15:35:58.005Z", 707, 9121, 298455, 79190, "Cividatti Casa e Construção Ltda", "79.190.000/0001-00", "2026-07-25T15:00:00.000Z", "2026-06-10T15:00:00.000Z"],
  ["2027075567", "2027", "EE SANTA QUITERIA", "Esmeraldas", "SRE/METROPOLITANA C", "Subprograma - Manutenção Escolar e Desenvolvimento do Ensino 2026", "Material de Consumo Geral", "2026-05-18T12:26:00.583Z", 702, 8364, 282516, 49316, "Tiago Xavier Bonfim", "49.316.000/0001-00", "2026-07-02T12:00:00.000Z", "2026-05-17T12:00:00.000Z"],
  ["2027075566", "2027", "EE NOSSA SENHORA DO CARMO", "Pará de Minas", "SRE/PARA DE MINAS", "Subprograma - Alimentação Estadual 2026", "Gêneros Alimentícios", "2026-05-18T14:02:57.356Z", 641, 8982, 282492, 51718, "SUPERMERCADO ALBINO LTDA", "51.718.000/0001-00", "2026-07-06T14:00:00.000Z", "2026-05-17T14:00:00.000Z"],
  ["2027075565", "2027", "EE DEPUTADO OLIVEIRA SOUZA", "Lavras", "SRE/CAMPO BELO", "Subprograma - Alimentação Estadual 2026", "Gêneros Alimentícios", "2026-05-15T17:02:53.560Z", 654, 9245, 281238, 65919, "Mercearia São Sebastião ltda", "65.919.000/0001-00", "2026-07-01T17:00:00.000Z", "2026-05-14T17:00:00.000Z"],
  ["2027075564", "2027", "EE DEPUTADO OLIVEIRA SOUZA", "Lavras", "SRE/CAMPO BELO", "Subprograma - Manutenção Escolar e Desenvolvimento do Ensino 2026", "Material de Consumo Geral", "2026-05-15T17:05:12.075Z", 720, 9245, 281217, 67457, "mercado bacana ltda", "67.457.000/0001-00", "2026-07-01T17:00:00.000Z", "2026-05-14T17:00:00.000Z"],
  ["2027075563", "2027", "EE DEPUTADO OLIVEIRA SOUZA", "Lavras", "SRE/CAMPO BELO", "Subprograma - Manutenção Escolar e Desenvolvimento do Ensino 2026", "Gás recarga", "2026-05-15T17:07:22.069Z", 720, 9245, 280988, 77734, "DISTRIBUIDORA ALHADAS GAS E AGUA LTDA", "77.734.000/0001-00", "2026-06-29T17:00:00.000Z", "2026-05-14T17:00:00.000Z"],
  ["2027075562", "2027", "EE MARGARIDA BROCHADO", "Betim", "SRE/METROPOLITANA B", "Subprograma - Manutenção Escolar e Desenvolvimento do Ensino 2026", "Material de Consumo Geral", "2026-05-26T13:36:33.156Z", 702, 8102, 276073, 65598, "COMERCIAL SUPER LIMP LTDA", "65.598.000/0001-00", "2026-07-09T13:00:00.000Z", "2026-05-25T13:00:00.000Z"],
  ["2027075561", "2027", "EE JOSE MAURILIO VALENTE", "Uberaba", "SRE/UBERABA", "Subprograma - Demandas Pedagógicas Excepcionais 2026", "Gêneros Alimentícios", "2026-05-05T16:34:52.068Z", 1440, 10639, 273697, 81588, "Amauri Santos Teixeira", "81.588.000/0001-00", "2026-06-20T16:00:00.000Z", "2026-05-04T16:00:00.000Z"],
  ["2027075560", "2027", "EE TEOFILO PIRES", "Januária", "SRE/JANUARIA", "Subprograma - Alimentação Federal 2026", "Gêneros Alimentícios", "2026-04-28T14:51:30.615Z", 1399, 9411, 273271, 105459, "LUCILIO FERREIRA DE MOURA", "105.459.000/0001-00", "2026-06-15T14:00:00.000Z", "2026-04-27T14:00:00.000Z"],
  ["2027075559", "2027", "EE DE ITAMOGI", "Itamogi", "SRE/PASSOS", "Subprograma - Alimentação Federal 2026", "Gêneros Alimentícios", "2026-05-07T14:45:41.411Z", 1412, 10080, 272700, 51698, "Pascal Indústria e Comércio de Carnes LTDA", "51.698.000/0001-00", "2026-06-21T14:00:00.000Z", "2026-05-06T14:00:00.000Z"],
  ["2027075558", "2027", "EE DEPUTADO OLIVEIRA SOUZA", "Lavras", "SRE/CAMPO BELO", "Subprograma - Manutenção Escolar e Desenvolvimento do Ensino 2026", "Conservação e pequenos reparos", "2026-05-06T14:16:39.367Z", 720, 9245, 272169, 99730, "Geyson Luciano Almeida Coelho", "99.730.000/0001-00", "2026-06-18T14:00:00.000Z", "2026-05-05T14:00:00.000Z"],
  ["2027075557", "2027", "EE DEPUTADO OLIVEIRA SOUZA", "Lavras", "SRE/CAMPO BELO", "Subprograma - Manutenção Escolar e Desenvolvimento do Ensino 2026", "Projetos Pedagógicos e Atividades Educacionais", "2026-05-04T17:48:55.659Z", 720, 9245, 270930, 66075, "VIAÇÃO SANTOS LTDA", "66.075.000/0001-00", "2026-06-16T17:00:00.000Z", "2026-05-03T17:00:00.000Z"],
  ["2027075555", "2027", "EE CANDIDO PORTINARI", "Ribeirão das Neves", "SRE/METROPOLITANA C", "Subprograma - Manutenção Escolar e Desenvolvimento do Ensino 2026", "Serviços Operacionais Contínuos", "2026-04-23T15:03:35.074Z", 702, 8119, 268589, 56429, "CENTRAL SUL SERVIÇOS INTELIGENTES EM SEGURANÇA E ENERGIA LTDA", "56.429.000/0001-00", "2026-06-08T15:00:00.000Z", "2026-04-22T15:00:00.000Z"],
  ["2027075554", "2027", "EE DEPUTADO OLIVEIRA SOUZA", "Lavras", "SRE/CAMPO BELO", "Subprograma - Alimentação Federal 2026", "Gêneros Alimentícios", "2026-05-04T14:59:11.236Z", 1397, 9245, 267018, 75566, "ORGANIZAÇÃO SANLIMA LTDA", "75.566.000/0001-00", "2026-06-17T14:00:00.000Z", "2026-05-03T14:00:00.000Z"],
  ["2027075553", "2027", "EE DEPUTADO OLIVEIRA SOUZA", "Lavras", "SRE/CAMPO BELO", "Subprograma - Alimentação Estadual 2026", "Gêneros Alimentícios", "2026-05-04T15:00:05.568Z", 654, 9245, 266891, 75566, "ORGANIZAÇÃO SANLIMA LTDA", "75.566.000/0001-00", "2026-06-17T15:00:00.000Z", "2026-05-03T15:00:00.000Z"],
  ["2027075552", "2027", "EE DEPUTADO OLIVEIRA SOUZA", "Lavras", "SRE/CAMPO BELO", "Subprograma - Alimentação Estadual 2026", "Gêneros Alimentícios", "2026-05-04T15:00:44.187Z", 654, 9245, 266789, 75566, "ORGANIZAÇÃO SANLIMA LTDA", "75.566.000/0001-00", "2026-06-17T15:00:00.000Z", "2026-05-03T15:00:00.000Z"],
  ["2027075551", "2027", "EE DEPUTADO OLIVEIRA SOUZA", "Lavras", "SRE/CAMPO BELO", "Subprograma - Alimentação Estadual 2026", "Gêneros Alimentícios", "2026-05-04T16:36:36.837Z", 654, 9245, 266735, 67457, "mercado bacana ltda", "67.457.000/0001-00", "2026-06-18T16:00:00.000Z", "2026-05-03T16:00:00.000Z"],
  ["2027075550", "2027", "EE DEPUTADO OLIVEIRA SOUZA", "Lavras", "SRE/CAMPO BELO", "Subprograma - Alimentação Estadual 2026", "Gêneros Alimentícios", "2026-05-04T16:39:17.671Z", 654, 9245, 266418, 78564, "COSTA & SILVA CASA DE CARNES E MERCEARIA LTDA", "78.564.000/0001-00", "2026-06-18T16:00:00.000Z", "2026-05-03T16:00:00.000Z"],
  ["2027075549", "2027", "EE RACHEL IANCU STEURMAN", "Belo Horizonte", "SRE/METROPOLITANA A", "Subprograma - Manutenção Escolar e Desenvolvimento do Ensino 2026", "Mobiliários Administrativos", "2026-04-23T10:14:25.708Z", 702, 8384, 264954, 49316, "Tiago Xavier Bonfim", "49.316.000/0001-00", "2026-06-08T10:00:00.000Z", "2026-04-22T10:00:00.000Z"],
  ["2027075547", "2027", "EE LEANDRO ANTONIO DE VITO", "Uberaba", "SRE/UBERABA", "Subprograma - Alimentação Federal 2026", "Gêneros Alimentícios", "2026-04-14T15:50:01.117Z", 1417, 10403, 260409, 83841, "ASSOCIAÇÃO DOS PRODUTORES DE HORTIFRUTIGRANJEIROS E DA AGROINDUSTRIA FAMILIAR DO VALE DO RIO GRANDE", "83.841.000/0001-00", "2026-05-30T15:00:00.000Z", "2026-04-13T15:00:00.000Z"],
  ["2027075546", "2027", "EE PADRE ANCHIETA", "Pouso Alegre", "SRE/POUSO ALEGRE", "Subprograma - Manutenção Escolar e Desenvolvimento do Ensino 2026", "Serviços Operacionais Contínuos", "2026-04-23T10:53:58.508Z", 678, 10534, 260408, 48399, "FORTE SEGURANCA ELETRONICA LTDA", "48.399.000/0001-00", "2026-06-07T10:00:00.000Z", "2026-04-22T10:00:00.000Z"],
  ["2027075545", "2027", "EE PADRE ANCHIETA", "Pouso Alegre", "SRE/POUSO ALEGRE", "Subprograma - Manutenção Escolar e Desenvolvimento do Ensino 2026", "Serviços Operacionais Contínuos", "2026-04-23T10:54:39.426Z", 678, 10534, 260278, 85106, "Conecta Net Telecomunicações Ltda.", "85.106.000/0001-00", "2026-06-07T10:00:00.000Z", "2026-04-22T10:00:00.000Z"],
  ["2027075544", "2027", "EE JACIR LOPES DUARTE", "Governador Valadares", "SRE/GOV. VALADARES", "Subprograma - Manutenção Escolar e Desenvolvimento do Ensino 2026", "Serviços Operacionais Contínuos", "2026-04-13T13:50:53.034Z", 694, 8846, 258006, 67976, "AC SOLUCOES CONTABEIS LTDA", "67.976.000/0001-00", "2026-05-29T13:00:00.000Z", "2026-04-12T13:00:00.000Z"],
  ["2027075543", "2027", "EE DONA SEMIANA", "Passos", "SRE/PASSOS", "Subprograma - Alimentação Federal 2026", "Gêneros Alimentícios", "2026-04-10T17:23:39.938Z", 1382, 10546, 255007, 49422, "ASSOCIAÇÃO DOS PRODUTORES RURAIS DO SUL DE MINAS", "49.422.000/0001-00", "2026-05-25T17:00:00.000Z", "2026-04-09T17:00:00.000Z"],
  ["2027075542", "2027", "EE EUCLIDES DA CUNHA", "Januária", "SRE/JANUARIA", "Subprograma - Alimentação Federal 2026", "Gêneros Alimentícios", "2026-04-10T13:51:57.743Z", 1395, 9467, 253570, 96811, "Lara Lorrany Mendes Nogueira", "96.811.000/0001-00", "2026-05-25T13:00:00.000Z", "2026-04-09T13:00:00.000Z"]
];

const orders: SeedOrder[] = orderRows.map(
  ([
    orderId,
    year,
    school,
    city,
    regional,
    subprogram,
    expenseGroup,
    purchaseDate,
    idSubprogram,
    idSchool,
    idBudget,
    idSupplier,
    supplierName,
    supplierDocument,
    deliveryDate,
    proposalDate
  ]) => ({
    orderId,
    year,
    school,
    city,
    regional,
    subprogram,
    expenseGroup,
    purchaseDate,
    idSubprogram,
    idSchool,
    idBudget,
    idSupplier,
    supplierName,
    supplierDocument,
    deliveryDate,
    proposalDate
  })
);

export const mockOpportunities: NormalizedOpportunity[] = orders.map(
  (order, index) => normalizeOrder(order, index)
);

export const opportunitySource: OpportunitySource = {
  async listOpportunities(filters = {}, page = {}) {
    const pageNumber = Math.max(1, page.page ?? 1);
    const pageSize = Math.min(48, Math.max(1, page.pageSize ?? 12));
    const filtered = mockOpportunities.filter((opportunity) =>
      matchesFilters(opportunity, filters)
    );
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const offset = (pageNumber - 1) * pageSize;

    return {
      data: filtered.slice(offset, offset + pageSize),
      total: filtered.length,
      page: pageNumber,
      pageSize,
      totalPages,
      facets: buildFacets(mockOpportunities)
    };
  },
  async getOpportunity(externalId) {
    return (
      mockOpportunities.find((opportunity) => opportunity.externalId === externalId) ??
      null
    );
  }
};

function normalizeOrder(order: SeedOrder, index: number): NormalizedOpportunity {
  const groupCategory = categoryByGroup[order.expenseGroup] ?? {
    slug: "outros",
    name: order.expenseGroup
  };
  const templateKey = chooseTemplate(order, index, groupCategory.slug);
  const items = templates[templateKey].map((entry, itemIndex) => ({
    ...entry,
    order: itemIndex + 1,
    quantity: entry.quantity + (index % 4) * 3,
    totalValue:
      entry.unitValue === null ? null : roundMoney((entry.quantity + (index % 4) * 3) * entry.unitValue)
  }));
  const totalValue = roundMoney(
    items.reduce((sum, entry) => sum + (entry.totalValue ?? 0), 0)
  );
  const category = {
    slug: groupCategory.slug,
    name: headlineFor(templateKey, groupCategory.name),
    confidence: 0.86,
    needsFallback: false
  };

  return {
    externalId: order.orderId,
    orderId: order.orderId,
    sourceUrl: `${SOURCE_BASE_URL}/public/purchase-orders/${order.orderId}`,
    idSubprogram: order.idSubprogram,
    idSchool: order.idSchool,
    idBudget: order.idBudget,
    idSupplier: order.idSupplier,
    school: order.school,
    city: order.city,
    regional: order.regional,
    expenseGroup: order.expenseGroup,
    subprogram: order.subprogram,
    year: order.year,
    purchaseDate: order.purchaseDate,
    proposalDate: order.proposalDate,
    deliveryDate: order.deliveryDate,
    purchaseOrderStatus: "ENVD",
    accountabilityStatus: "NENV",
    supplierName: order.supplierName,
    supplierDocument: order.supplierDocument,
    initiativeDescription: summaryFor(templateKey, order.expenseGroup),
    items,
    attachments: attachmentsFor(order, index),
    totalValue,
    itemCount: items.length,
    category,
    headline: category.name,
    summary: summaryFor(templateKey, order.expenseGroup),
    topItems: items.slice(0, 5).map((entry) => entry.name.toLowerCase()),
    rawJson: {
      fixture: "pagesize_1000.json",
      order: {
        orderId: order.orderId,
        year: order.year,
        school: order.school,
        subprogram: order.subprogram,
        expenseGroup: order.expenseGroup,
        accountabilityStatus: "NENV",
        purchaseDate: order.purchaseDate,
        idSubprogram: order.idSubprogram,
        idSchool: order.idSchool,
        idBudget: order.idBudget,
        idSupplier: order.idSupplier
      }
    }
  };
}

function item(
  order: number,
  name: string,
  description: string,
  unit: string,
  quantity: number,
  unitValue: number
): OpportunityItem {
  return {
    order,
    name,
    description,
    unit,
    quantity,
    unitValue,
    totalValue: roundMoney(quantity * unitValue),
    isPermanent: false,
    expenseCategory: "Custeio"
  };
}

function chooseTemplate(order: SeedOrder, index: number, categorySlug: string) {
  if (order.supplierName.toLowerCase().includes("padaria")) return "panificacao";
  if (order.supplierName.toLowerCase().includes("açougue")) return "carnes";
  if (order.supplierName.toLowerCase().includes("hortifrut")) return "hortifruti";
  if (categorySlug === "alimentos") {
    return ["alimentos", "hortifruti", "carnes"][index % 3];
  }
  return categorySlug;
}

function headlineFor(templateKey: string, fallback: string) {
  const names: Record<string, string> = {
    alimentos: "Mercearia escolar",
    panificacao: "Pães e panificação",
    carnes: "Carnes e frios",
    hortifruti: "Frutas e Verduras",
    manutencao: "Manutenção predial",
    reparos: "Reparos e conservação",
    pedagogico: "Projetos pedagógicos",
    "servicos-operacionais": "Serviços operacionais",
    seguranca: "Segurança eletrônica",
    consumo: "Material de consumo",
    gas: "Gás de cozinha",
    mobiliario: "Mobiliário administrativo"
  };

  return names[templateKey] ?? fallback;
}

function summaryFor(templateKey: string, expenseGroup: string) {
  const summaries: Record<string, string> = {
    alimentos:
      "Fornecedor para gêneros alimentícios de mercearia destinados à alimentação escolar.",
    panificacao:
      "Fornecedor para pães e produtos de panificação destinados à merenda escolar.",
    carnes:
      "Fornecedor para carnes, frango e frios destinados ao preparo de refeições escolares.",
    hortifruti:
      "Fornecedor para frutas, verduras e hortaliças destinadas à alimentação escolar.",
    manutencao:
      "Fornecedor para manutenção predial, reparos elétricos, hidráulicos e pintura escolar.",
    reparos:
      "Fornecedor para conservação, pequenos reparos e limpeza técnica da estrutura escolar.",
    pedagogico:
      "Fornecedor para materiais, transporte e apoio a atividades pedagógicas da escola.",
    "servicos-operacionais":
      "Fornecedor para serviços recorrentes de operação, limpeza, controle de pragas ou conectividade.",
    seguranca:
      "Fornecedor para equipamentos e instalação de segurança eletrônica patrimonial.",
    consumo:
      "Fornecedor para material de limpeza, escritório e consumo recorrente da escola.",
    gas: "Fornecedor para recarga de gás GLP usado na cozinha escolar.",
    mobiliario:
      "Fornecedor para mobiliário administrativo usado em secretaria, salas e atendimento."
  };

  return summaries[templateKey] ?? `Fornecedor para ${expenseGroup.toLowerCase()}.`;
}

function attachmentsFor(order: SeedOrder, index: number) {
  if (index % 5 !== 0) return [];

  return [
    {
      id: 413227 + index,
      filename: `${order.orderId}-processo.pdf`,
      thumbUrl: "/public/files/thumb?key=1170dbf5-a6fc-4a96-ae87-0d2387663471.pdf",
      url: null
    },
    {
      id: 413228 + index,
      filename: `${order.orderId}-cotacao.pdf`,
      thumbUrl: "/public/files/thumb?key=2e219991-cd22-4a92-a840-c569c2edd82a.pdf",
      url: null
    }
  ];
}

function matchesFilters(
  opportunity: NormalizedOpportunity,
  filters: OpportunityFilters
) {
  return (
    matchesText(opportunity.city, filters.city) &&
    matchesText(opportunity.category?.slug, filters.category) &&
    matchesText(opportunity.expenseGroup, filters.expenseGroup) &&
    matchesText(opportunity.school, filters.school) &&
    matchesPeriod(opportunity.purchaseDate, filters.periodStart, filters.periodEnd) &&
    matchesQuery(opportunity, filters.query)
  );
}

function matchesText(value: string | null | undefined, filter: string | undefined) {
  if (!filter) return true;
  return normalize(value ?? "") === normalize(filter);
}

function matchesPeriod(
  value: string | null,
  periodStart: string | undefined,
  periodEnd: string | undefined
) {
  if (!periodStart && !periodEnd) return true;
  if (!value) return false;
  const time = new Date(value).getTime();
  if (periodStart && time < new Date(`${periodStart}T00:00:00.000Z`).getTime()) {
    return false;
  }
  if (periodEnd && time > new Date(`${periodEnd}T23:59:59.999Z`).getTime()) {
    return false;
  }
  return true;
}

function matchesQuery(opportunity: NormalizedOpportunity, query: string | undefined) {
  if (!query) return true;
  const haystack = [
    opportunity.school,
    opportunity.city,
    opportunity.expenseGroup,
    opportunity.headline,
    opportunity.summary,
    opportunity.initiativeDescription,
    opportunity.supplierName,
    ...opportunity.topItems,
    ...opportunity.items.flatMap((entry) => [entry.name, entry.description])
  ]
    .filter(Boolean)
    .join(" ");

  return normalize(haystack).includes(normalize(query));
}

function buildFacets(opportunities: NormalizedOpportunity[]) {
  return {
    cities: uniqueSorted(opportunities.map((opportunity) => opportunity.city)),
    categories: uniqueSorted(
      opportunities.map((opportunity) => opportunity.category?.slug)
    ),
    expenseGroups: uniqueSorted(
      opportunities.map((opportunity) => opportunity.expenseGroup)
    ),
    schools: uniqueSorted(opportunities.map((opportunity) => opportunity.school))
  };
}

function uniqueSorted(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort(
    (left, right) => left.localeCompare(right, "pt-BR")
  );
}

export function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
