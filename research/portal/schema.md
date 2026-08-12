# Schema observado

## listing

Amostras: 30

| Campo | Tipo(s) | Sempre preenchido? | Exemplo |
|---|---:|---:|---|
| `accountabilitySent` | boolean | sim | false |
| `accountabilityStatus` | string | sim | "NENV" |
| `expenseGroup` | string | sim | "Gêneros Alimentícios" |
| `idBudget` | number | sim | 338067 |
| `idSchool` | number | sim | 9458 |
| `idSubprogram` | number | sim | 1396 |
| `idSupplier` | number | sim | 45217 |
| `orderId` | string | sim | "2027075592" |
| `purchaseDate` | string | sim | "2026-08-10T20:44:01.883Z" |
| `school` | string | sim | "EE CORONEL ARISTIDES BATISTA" |
| `subprogram` | string | sim | "Subprograma - Alimentação Federal 2026" |
| `year` | string | sim | "2027" |

## detail

Amostras: 3

| Campo | Tipo(s) | Sempre preenchido? | Exemplo |
|---|---:|---:|---|
| `budgetOrder` | string | sim | "2027075592" |
| `dtDelivery` | string | sim | "2026-09-02T19:06:11.000Z" |
| `dtProposalSubmission` | string | sim | "2026-08-04T19:06:11.000Z" |
| `expenseGroupDescription` | string | sim | "Gêneros Alimentícios" |
| `inNaturalPersonAllowed` | boolean | sim | false |
| `initiativeDescription` | string | sim | "Destinado à compra de pães e produtos de panificação para a merenda escolar." |
| `purchaseOrderStatus` | string | sim | "ENVD" |
| `subprogramName` | string | sim | "Subprograma - Alimentação Federal 2026" |
| `supplierDocument` | string | sim | "07.571.867/0001-46" |
| `supplierName` | string | sim | "PADARIA E MERCEARIA SOUTO E MACEDO LTDA" |
| `year` | number | sim | 2027 |

## item

Amostras: 12

| Campo | Tipo(s) | Sempre preenchido? | Exemplo |
|---|---:|---:|---|
| `inPermanent` | boolean | sim | false |
| `nuItemOrder` | number | sim | 1 |
| `nuQuantity` | number | sim | 200 |
| `nuReferralValue` | null | não |  |
| `nuValueByItem` | number | sim | 25 |
| `txBudgetItemType` | string | sim | "Pão de sal" |
| `txBudgetItemUnit` | string | sim | "KG" |
| `txDescription` | string | sim | "Pão de sal tipo francês, fresco, de primeira qualidade, produzido no dia da entrega, com casca crocante, miolo macio e uniforme, isento de sujidades, mofo, odores ou sabores estra |
| `txExpenseCategory` | string | sim | "Custeio" |
| `txWarrantyDescription` | null | não |  |

## attachment

Amostras: 2

| Campo | Tipo(s) | Sempre preenchido? | Exemplo |
|---|---:|---:|---|
| `filename` | string | sim | "1170dbf5-a6fc-4a96-ae87-0d2387663471.pdf" |
| `id` | number | sim | 413227 |
| `thumbUrl` | string | sim | "/public/files/thumb?key=1170dbf5-a6fc-4a96-ae87-0d2387663471.pdf" |
| `url` | string | não |  |

