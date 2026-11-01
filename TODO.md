# Entregas — Reconstrução completa do Painel Dono

## Backend real e autorização

- [ ] Toda operação privilegiada valida o Firebase ID token e o `OWNER_UID` no backend; o frontend não decide permissões.
- [ ] Nenhuma operação usa IDs temporários `local-*`; geração, atualização e exclusão usam documentos reais do Firestore.
- [ ] As respostas não expõem service account, private key, pepper ou key completa depois da criação.
- [ ] As Firestore Rules permanecem deny-by-default para acesso direto do cliente, enquanto o backend Admin executa as operações autorizadas.

## Acessos Admin

- [ ] Gerar acesso Admin com prefixo configurável, créditos iniciais e limite de dispositivos.
- [ ] Mostrar a key completa somente no momento da criação e manter somente hash/preview persistente.
- [ ] Exibir lista separada e persistente, com o acesso mais recente primeiro e busca própria.
- [ ] Adicionar e remover qualquer quantidade de créditos.
- [ ] Pausar, retomar, bloquear, desbloquear e excluir acesso Admin.
- [ ] Registrar geração, alteração de créditos, pausa, bloqueio, desbloqueio e exclusão na auditoria.

## Keys Snapchat

- [ ] Gerar keys com prefixo configurável, qualquer quantidade de dias e limite de 1 a 10 dispositivos.
- [ ] Salvar no Firestore antes de mostrar na lista e iniciar com status `ready`.
- [ ] Começar a contagem no primeiro uso válido, independentemente de quem criou a key.
- [ ] Pausar e retomar congelando o saldo de tempo.
- [ ] Bloquear, desbloquear, adicionar dias, remover dias e resetar dispositivo sem reiniciar o prazo.
- [ ] Aplicar pausa global para interromper o acesso Snapchat durante atualização.
- [ ] Pesquisar por key, status, Admin criador, IP e identificador de instalação.
- [ ] Excluir definitivamente a key, remover seus vínculos e fazê-la desaparecer da lista, preservando apenas auditoria mínima.
- [ ] Atualizar a lista real depois de cada ação e ordenar a criação mais recente primeiro.

## Dispositivos e IPs

- [ ] Listar instalações vinculadas, limite, quantidade usada, último uso e IP observado.
- [ ] Bloquear e desbloquear por identificador de instalação.
- [ ] Bloquear e desbloquear por IP com aviso sobre NAT/VPN.
- [ ] Consultar keys relacionadas a dispositivo ou IP.
- [ ] Resetar os vínculos de uma key e liberar outro dispositivo sem alterar validade.

## Auditoria e configurações

- [ ] Registrar criação, primeiro uso, pausa, retomada, bloqueio, desbloqueio, exclusão, reset e ajustes de dias/créditos.
- [ ] Mostrar auditoria ordenada por evento mais recente.
- [ ] Mostrar estado de conexão Firebase, projeto, plano Spark e pausa global.
- [ ] Manter as telas Admin e Snapchat como fases posteriores, sem misturar permissões.
