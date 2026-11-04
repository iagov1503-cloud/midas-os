#!/bin/zsh
cd -- "${0:A:h}" || exit 1

NODE_EXECUTABLE="$(command -v node)"
if [[ -z "$NODE_EXECUTABLE" ]]; then
  for candidate in /opt/homebrew/bin/node /usr/local/bin/node; do
    if [[ -x "$candidate" ]]; then
      NODE_EXECUTABLE="$candidate"
      break
    fi
  done
fi

if [[ -z "$NODE_EXECUTABLE" ]]; then
  print 'Node.js não encontrado. Instale o Node.js 24 ou superior: https://nodejs.org/'
else
  print 'Iniciando o Midas OS…'
  MIDAS_OPEN_BROWSER=1 "$NODE_EXECUTABLE" start.js
fi

print '\nO Midas foi encerrado. Se ocorreu um erro, copie a mensagem acima.'
read -r '?Pressione Enter para fechar esta janela.'
