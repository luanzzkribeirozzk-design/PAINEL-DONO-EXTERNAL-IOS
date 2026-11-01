# Entregas — Painel Dono

## Fundação segura do projeto

- [x] Criar a estrutura web responsiva do Painel Dono com o nome `LN XITER` no topo.
- [x] Configurar o projeto para usar o Firebase `zayron-store` sem incluir credenciais privadas no código.
- [x] Configurar autenticação por e-mail e senha para o único usuário Dono.
- [x] Validar o `OWNER_UID` no backend em toda operação privilegiada.
- [x] Criar rotas server-side com validação de entrada e respostas sem dados secretos.

## Dados e autorização

- [ ] Criar o modelo Firestore para acessos Admin, créditos, licenses/keys, dispositivos, bloqueios, flags globais e auditoria.
- [ ] Manter keys em listas organizadas, com a última gerada primeiro.
- [ ] Separar visualmente e por consulta as keys de Admin e as keys do Snapchat.
- [ ] Aplicar autorização deny-by-default e impedir acesso de Admin às operações do Dono.
- [ ] Registrar ações críticas sem armazenar senha, private key ou key em texto puro desnecessariamente.

## Acessos Admin

- [ ] Permitir gerar acesso para o Painel Admin.
- [ ] Permitir definir o limite de dispositivos no momento da geração.
- [ ] Permitir adicionar ou remover qualquer quantidade de créditos.
- [ ] Permitir bloquear, desbloquear ou excluir acesso Admin.
- [ ] Permitir bloquear acesso Admin por identificador seguro de instalação.
- [ ] Exibir busca e lista separada de acessos Admin.

## Keys Snapchat

- [ ] Permitir gerar keys com quantidade livre de dias e limite de dispositivos.
- [ ] Permitir prefixo configurável, com padrão `EXTERNAL`.
- [ ] Permitir pausar, despausar, bloquear, desbloquear e excluir keys.
- [ ] Permitir adicionar/remover dias de uma key.
- [ ] Permitir adicionar/remover dias de todas as keys.
- [ ] Permitir pausa global durante atualização.
- [ ] Mostrar o Admin que criou cada key.
- [ ] Permitir pesquisa por key, status, Admin, IP e identificador de instalação.

## Dispositivos e auditoria

- [ ] Mostrar identificador de instalação associado à licença.
- [ ] Mostrar IP observado com data/hora, tratando-o como sinal auxiliar.
- [ ] Permitir ao Dono bloquear/desbloquear por identificador de instalação.
- [ ] Permitir ao Dono bloquear/desbloquear por IP com confirmação e auditoria.
- [ ] Permitir consultar keys relacionadas a IP ou identificador.
- [ ] Registrar criação, pausa, bloqueio, desbloqueio, exclusão e ajustes de dias.

## Não iniciar nesta fase

- [ ] Painel Admin separado.
- [ ] Login por key no Snapchat.
- [ ] App Check/App Attest na IPA.
- [ ] Integração do `GoogleService-Info.plist` no app.
