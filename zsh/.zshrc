export STARSHIP_CONFIG="$HOME/.config/starship/starship.toml"
eval "$(starship init zsh)"
eval "$(zoxide init zsh)"
eval "$(fnm env --use-on-cd)"

# Visual Studio Code CLI
export PATH="/Applications/Visual Studio Code.app/Contents/Resources/app/bin:$PATH"

alias lg="lazygit"

# pnpm
export PNPM_HOME='/Users/daldridgetheperfumeshop.com/Library/pnpm'
case ":$PATH:" in
  *":$PNPM_HOME/bin:"*) ;;
  *) export PATH="$PNPM_HOME/bin:$PATH" ;;
esac
# pnpm end
