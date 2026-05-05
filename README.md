This is a fork of https://github.com/jc21/docker-registry-ui , although its an old nodejs version, we are going to revive this project for a breif time before we rewrite it


docker login docker.gingersociety.org -u __token__ -p $(jq -r '.API_TOKEN' ~/.ginger-society/auth.json)
