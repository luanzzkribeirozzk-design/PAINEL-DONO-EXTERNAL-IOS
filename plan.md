# Plano de reconstrução — Painel Dono / ZAYRON STORE

## Objetivo

Refazer o Painel Dono como um painel operacional real, sem ações simuladas. O Dono é o único proprietário e terá controle total sobre Admins, créditos, keys Snapchat, dispositivos, IPs, pausa global, auditoria e configurações. O Painel Admin e o Snapchat continuam como fases posteriores, mas todas as operações compartilhadas serão modeladas para reutilização.

## Funções obrigatórias do Dono

### Acessos Admin

- Gerar acesso Admin com prefixo configurável, créditos iniciais e limite de dispositivos.
- Salvar somente hash da key no Firestore e mostrar a key completa apenas na criação.
- Manter lista persistente com o acesso mais recente no topo.
- Pesquisar acessos Admin separadamente.
- Adicionar ou remover qualquer quantidade de créditos.
- Pausar, retomar, bloquear, desbloquear e excluir acesso Admin.
- Resetar vínculos de dispositivo do acesso quando necessário.
- Registrar todas as operações na auditoria.

### Keys Snapchat

- Gerar key com prefixo configurável, qualquer quantidade de dias e limite de 1 a 10 dispositivos.
- Salvar a key no Firestore antes de exibi-la na lista; nunca criar IDs `local-*` no frontend.
- Iniciar a contagem somente no primeiro uso válido do Snapchat.
- Pausar e retomar congelando o tempo restante.
- Bloquear, desbloquear, adicionar dias, remover dias e resetar dispositivo sem reiniciar o prazo.
- Pausar ou retomar todas as keys pela pausa global.
- Pesquisar por key, status, Admin criador, IP e identificador de instalação.
- Excluir definitivamente o documento da key e seus vínculos de dispositivo; manter apenas auditoria mínima e fazer a key desaparecer da lista após sucesso.
- Mostrar a key mais recente primeiro e atualizar a lista depois de cada operação real.

### Dispositivos, IPs e auditoria

- Mostrar vínculos de instalação, quantidade usada, último uso e IP observado quando disponível.
- Bloquear e desbloquear por identificador de instalação.
- Bloquear e desbloquear por IP com aviso de que NAT/VPN podem afetar outros usuários.
- Consultar keys relacionadas ao dispositivo ou IP.
- Registrar criação, pausa, retomada, bloqueio, desbloqueio, exclusão, reset e alteração de dias/créditos.
- Não usar IMEI, número de série ou HWID invasivo; o identificador futuro do iPhone será aleatório e guardado no Keychain.

## Backend e segurança

Todas as operações passam por rotas server-side, validam o Firebase ID token e o `OWNER_UID`, validam os dados recebidos e não confiam em estado ou permissões do frontend. O frontend usa apenas configuração pública do Firebase Web SDK. A service account, pepper e dados sensíveis permanecem nas variáveis protegidas da Vercel. As Firestore Rules permanecem deny-by-default porque o backend Admin é o único escritor.

## Estrutura

- `src/App.tsx`: shell, telas e botões conectados às ações reais.
- `src/api.ts`: cliente autenticado e tratamento de erros.
- `src/types.ts`: contratos das entidades e status.
- `api/owner/action.ts`: mutations do Dono, transações, auditoria e exclusões.
- `api/owner/dashboard.ts`: consultas reais, listas, vínculos e auditoria.
- `api/license/activate.ts`: primeiro uso, expiração, pausa global e vínculo de instalação.
- `firestore.rules`: acesso direto negado ao cliente.
