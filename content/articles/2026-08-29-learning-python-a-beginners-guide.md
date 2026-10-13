---
title: "Learning Python: A Beginner's Guide"
slug: learning-python-a-beginners-guide
date: 2026-08-29
category: Tutorials
tags: [python, tutorials, learning]
excerpt: Variables, lists, loops and functions in one sitting, with small programs you can run and change.
---

Python is a good first language because it reads almost like plain English. This guide covers the handful of ideas you will use in nearly every program.

## Run your first script

Save the following as `hello.py` and run it with `python hello.py`:

```python
name = "world"
print(f"Hello, {name}!")
```

The `f` before the quotes lets you place variables inside `{}` braces.

## Variables and types

A variable is a name for a value. Python figures out the type for you.

```python
age = 30            # int
price = 19.99       # float
language = "Python" # str
is_ready = True     # bool
```

## Lists and loops

A list holds several values in order. A `for` loop visits each one.

```python
scores = [72, 88, 95, 64]

for score in scores:
    if score >= 70:
        print(score, "pass")
    else:
        print(score, "needs work")
```

Indentation is not decoration in Python — it defines which lines belong to the loop or the `if`.

## Functions

Wrap steps you repeat in a function and give it a clear name.

```python
def average(values):
    return sum(values) / len(values)

print(average([72, 88, 95, 64]))
```

## Practise by changing things

Reading is not enough. Take each example above and change it: add a score, pass a different list to `average`, print a different message. When something breaks, read the error message from the bottom up; the last line usually names the problem.

## Where to go next

Learn dictionaries and how to read a file, then build something small that you would actually use, such as a script that renames photos or totals a spreadsheet column. The official tutorial at <https://docs.python.org/3/tutorial/> is thorough and free.
