# Ember 3.25 Template Regression

This is a simple repo to help in debugging the template compilation speed regression in Ember 3.25.

## Usage

To use this, run `yarn install`, then to run the benchmark/comparison, run `yarn bench`.

At the end of the comparison, you should see something like:

```
Total precompile time using `ember-source@3.24` 10129
Total precompile time using `ember-source@3.25` 52417
```
