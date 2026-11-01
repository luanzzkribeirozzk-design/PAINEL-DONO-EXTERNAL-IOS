# PAINEL-DONO-EXTERNAL-IOS

Painel Dono da ZAYRON STORE, com frontend React/Vite, Firebase Authentication, Firestore e rotas server-side para operações privilegiadas.

## Desenvolvimento

```bash
npm install
npm run dev
```

O site abre na porta 3000. Sem variáveis públicas do Firebase, a tela de login mostra o modo de configuração e o dashboard usa dados de demonstração para permitir revisão visual.

## Variáveis na Vercel

Cadastre as variáveis públicas do frontend:

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

Cadastre como Secrets de execução, nunca como valores do frontend:

```text
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
OWNER_UID
LICENSE_PEPPER
```

`FIREBASE_PRIVATE_KEY` deve ser o valor da private key do JSON da service account, com quebras de linha preservadas ou representadas como `\\n`. `LICENSE_PEPPER` deve ser um segredo aleatório criado antes do deploy. Não envie esses valores para o GitHub nem para o chat.

Depois de validar o deploy, publique o arquivo `firestore.rules` no Firebase Console. Ele fecha o acesso direto do navegador; a API server-side continua sendo a única camada autorizada para geração, ativação, pausa e reset.

## Segurança

O cliente não acessa o Firestore diretamente. `firestore.rules` usa deny-by-default e as operações passam pelas funções em `api/owner`. As funções verificam o token Firebase, comparam o UID com `OWNER_UID` e registram ações críticas em `auditEvents`. Keys são armazenadas por hash e a chave completa é entregue apenas no momento da geração.

## Sessão e instalação

O login oferece **Lembrar acesso neste dispositivo**. Quando marcado, o Firebase mantém a sessão localmente; quando desmarcado, a sessão fica somente na sessão atual. A senha nunca é salva pelo site.

O painel possui manifesto e service worker PWA. Em navegadores Android compatíveis, o botão **Instalar** abre a instalação. No iPhone, o botão explica o fluxo oficial: **Compartilhar > Adicionar à Tela de Início**. A mesma estrutura pode ser reutilizada no futuro Painel Admin.

## Ciclo de vida das keys

Uma key Snapchat recém-gerada fica `ready` e não consome dias. A rota `api/license/activate` inicia o prazo somente no primeiro uso válido, vincula o dispositivo dentro do limite e calcula a expiração. A pausa calcula e guarda o saldo restante; a retomada usa esse saldo e não o relógio original. O reset do Dono remove os vínculos de dispositivo e mantém todo o prazo já consumido. O futuro Painel Admin deve chamar as mesmas operações autorizadas, sem duplicar a regra.
