export STARSHIP_CONFIG="$HOME/.config/starship/starship.toml"
eval "$(starship init zsh)"
eval "$(zoxide init zsh)"
eval "$(fnm env --use-on-cd)"

alias lg="lazygit"
