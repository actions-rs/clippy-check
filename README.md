# Rust `clippy-check` Action

![MIT licensed](https://img.shields.io/badge/license-MIT-blue.svg)
[![Gitter](https://badges.gitter.im/actions-rs/community.svg)](https://gitter.im/actions-rs/community)

> Clippy lints in your Pull Requests

This GitHub Action executes [`clippy`](https://github.com/rust-lang/rust-clippy)
and posts all lints as annotations for the pushed commit, as in the live example [here](https://github.com/actions-rs/example/pull/2/files).

![Screenshot](./.github/screenshot.png)

## Example workflow

This example is utilizing [`toolchain`](https://github.com/actions-rs/toolchain) Actions
to install the most recent `nightly` clippy version.

```yaml
on: push
name: Clippy check
jobs:
  clippy_check:
    runs-on: ubuntu-latest
    permissions:
      checks: write
    steps:
      - uses: actions/checkout@v1
      - uses: actions-rs/toolchain@v1
        with:
            toolchain: nightly
            components: clippy
            override: true
      - uses: actions-rs/clippy-check@v1
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          args: --all-features
```

### With stable clippy

```yaml
on: push
name: Clippy check
jobs:
  clippy_check:
    runs-on: ubuntu-latest
    permissions:
      checks: write
    steps:
      - uses: actions/checkout@v1
      - run: rustup component add clippy
      - uses: actions-rs/clippy-check@v1
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          args: --all-features
```

## Inputs

| Name        | Required | Description                                                                                                                            | Type   | Default |
| ------------| :------: | ---------------------------------------------------------------------------------------------------------------------------------------| ------ | --------|
| `token`     | ✓        | GitHub secret token, usually a `${{ secrets.GITHUB_TOKEN }}`                                                                           | string |         |
| `toolchain` |          | Rust toolchain to use; override or system default toolchain will be used if omitted                                                    | string |         |
| `args`      |          | Arguments for the `cargo clippy` command                                                                                               | string |         |
| `use-cross` |          | Use [`cross`](https://github.com/rust-embedded/cross) instead of `cargo`                                                               | bool   | false   |
| `name`      |          | Name of the created GitHub check. If running this action multiple times, each run must have a unique name.                             | string | clippy  |

For extra details about the `toolchain`, `args` and `use-cross` inputs,
see [`cargo` Action](https://github.com/actions-rs/cargo#inputs) documentation.

**NOTE**: if your workflow contains multiple instances of the `clippy-check` action you will need to give each invocation a unique name, using the `name` property described above.
Check runs must have a unique name, and this prevents a later check run overriding a previous one within the same workflow.

## Limitations

Due to [token permissions](https://help.github.com/en/articles/virtual-environments-for-github-actions#token-permissions),
this Action **WILL NOT** be able to post `clippy` annotations for Pull Requests from the forked repositories.

This is a pretty big problem, which can be solved only by Github themselves,
see [#2](https://github.com/actions-rs/clippy-check/issues/2) for details.\
As a fallback this Action will output all clippy messages into the stdout
and fail the result correspondingly.
