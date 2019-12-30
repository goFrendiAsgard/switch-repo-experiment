# Switch Repo

Embracing monorepo without abandoning multi-repo

```
multi-repo --> mono-repo --> multi-repo
```

# Use Case

* You already have several repos. You know merging them into mono-repo could give you some advantages, however some of your repos are private, and some others are open-source. You cannot just mix them up into a single mono-repo.

* Switch-repo let you enlist your external repositories in a json file.

* By performing `node main.js pull`, Switch-repo will perform `git commit` (if repo exists) then delete all external repositories and re-clone them.

* By performing `node main.js push`, Switch-repo will perform `git push` to all external repositories.

* By performing `node main.js run`, Switch-repo will run all services and containers.

# Configuration

For now, it is in `config.json`.