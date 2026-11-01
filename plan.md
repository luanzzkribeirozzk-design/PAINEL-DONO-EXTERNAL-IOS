# Plano — Painel Dono / ZAYRON STORE

## Escopo desta fase

Construir somente o Painel Dono. O Painel Admin e o Snapchat serão fases posteriores. O sistema usará o projeto Firebase `zayron-store`, Firebase Authentication para o único usuário Dono e Firestore para os dados. As operações privilegiadas passarão por backend server-side; a service account nunca será enviada ao navegador, ao GitHub ou ao app iOS.

## Arquitetura

O frontend será um dashboard web responsivo. O backend será composto por rotas server-side do projeto, com validação de sessão Firebase, verificação explícita do `OWNER_UID`, validação de entrada, rate limiting básico e auditoria. O Firestore será o banco externo e ficará em Production mode. A configuração pública do Firebase ficará em variáveis públicas do frontend; a credencial Admin e o `LICENSE_PEPPER` ficarão somente em Secrets de execução.

## Modelo de dados inicial

- `users/{uid}`: papel, status, data de criação e último acesso.
- `adminAccess/{id}`: hash da key de Admin, status, limite de dispositivos e timestamps.
- `adminCredits/{adminUid}`: saldo, versão de concorrência e histórico resumido.
- `licenses/{id}`: hash da key, tipo, dias, expiração, status, criador e limite de dispositivos.
- `licenseDevices/{licenseId_deviceId}`: vínculo da instalação, primeiro/último uso e metadados mínimos.
- `blockedDevices/{deviceId}`: bloqueio do identificador de instalação, motivo e autor.
- `blockedIPs/{ipHash}`: bloqueio opcional por IP, com motivo e status.
- `auditEvents/{id}`: ator, ação, recurso, resultado e data/hora.
- `systemFlags/global`: pausa global, manutenção e versão de política.

As keys não serão usadas como IDs do Firestore nem armazenadas em texto puro por padrão. A key nasce com status `ready` e `activatedAt` vazio; os dias só começam na primeira ativação válida no Snapchat. Ao pausar uma key, o backend calcula e guarda o saldo restante e interrompe a contagem. Ao retomar, recria `expiresAt` a partir do saldo restante. O reset de dispositivo remove os vínculos de instalação e libera o uso em outro dispositivo, sem alterar `activatedAt`, `expiresAt` ou o saldo de tempo. Geração, ativação, expiração, exclusão, pausa, bloqueio, reset e adição/remoção de dias serão operações server-side e auditadas. A mesma lógica será reutilizada pelo futuro Painel Admin.

## Telas da primeira versão

1. Login do Dono por e-mail e senha.
2. Dashboard com resumo de Admins, créditos, keys ativas, keys pausadas e bloqueios.
3. Lista separada de acessos Admin.
4. Lista separada de keys do Snapchat, com busca e item mais recente primeiro.
5. Formulário de geração de acesso Admin: formato, quantidade de dispositivos e créditos.
6. Formulário de geração de key Snapchat: prefixo, dias livres, limite de dispositivos e quantidade.
7. Detalhe de key com ações conforme o Dono: pausar, despausar, bloquear, desbloquear, excluir e ajustar dias.
8. Gestão de dispositivos e IPs, incluindo consulta de keys relacionadas.
9. Auditoria de ações críticas.
10. Configurações do Dono e sinalização de manutenção/pausa global.

## Design

Direção escolhida: dashboard clean moderno, com superfícies escuras opcionais, cartões compactos e hierarquia forte. O topo exibirá `LN XITER`. O layout priorizará navegação lateral no desktop e navegação inferior/compacta no celular. Cores de status serão semânticas: vermelho para bloqueado, âmbar para pausado, verde para ativo e azul para informação. O visual não usará neon excessivo no painel de gestão para preservar legibilidade e reduzir erros operacionais.

## Fluxo de entrega

Primeiro será criada a base do projeto, autenticação visual e shell do dashboard sem dados reais. Depois serão adicionadas as rotas server-side e o modelo Firestore. Em seguida, as operações de geração e gestão serão conectadas com transações e auditoria. Por fim, serão configuradas variáveis públicas, Secrets da Vercel, regras e testes de autorização. O Admin não será iniciado antes de o Dono funcionar.

## Segurança

O frontend nunca decidirá se o usuário é Dono. Cada operação verificará a sessão e o UID no backend. As regras do Firestore serão restritivas. Logs não conterão senha, service account, private key, key em texto puro ou `LICENSE_PEPPER`. O IP será tratado como dado auxiliar e o identificador de instalação será aleatório, não um HWID físico do iPhone.
