[![Build Status](https://travis-ci.org/anujk14/XML-To-Blockly.svg?branch=gh-pages)](https://travis-ci.org/anujk14/XML-To-Blockly)

# Introduction

This [project](https://anujk14.github.io/XML-To-Blockly/) is funded by the 2016 edition of the [Google Summer of Code program](https://summerofcode.withgoogle.com/).
[Anuj Khandelwal](https://github.com/anujk14/) has been selected to work on a [Graphical workflow editor for eHive using Blockly](https://summerofcode.withgoogle.com/projects/#5041231054766080) in the [Ensembl Genomes Browser](https://summerofcode.withgoogle.com/organizations/6373155673210880/) organization under the supervision of [Matthieu Muffato](www.ebi.ac.uk/~muffato/) and [Leo Gordon](https://github.com/ens-lg4/).

[eHive](https://github.com/Ensembl/ensembl-hive) is a system used to run computation pipelines in distributed environments.
Currently the eHive workflows are configured in a specific file format that requires basic programming skills.
This project aims at removing this drawback by creating a graphical editor for eHive workflows using Google's [Blockly](https://developers.google.com/blockly/) library.

We are envisaging XML as the file format, with a [Relax NG specification](http://relaxng.org/spec-20011203.html).
The backbone of this graphical editor would be an automated conversion of a Relax NG specification to Blockly blocks and matching rules so that the Blockly diagrams conform to the specification.
The graphical interface will have to be able to import existing XML files to visualize them in terms of Blockly blocks, edit them, and export the diagram back to XML.

The project submitted to Google is not specific to eHive and the proposed editor should be able of handling any specifications written using the Relax NG schema.

# How to use

1. Open https://anujk14.github.io/XML-To-Blockly/ in your web browser.
2. Click on the 'Choose file' and open a Relax NG file. This will create a list of blocks in the toolbox.
3. Play with the blocks to create a diagram that follows the specification.

# Current state

1. [x] Web page with a Blockly workspace, an RNG text-area and an XML
   text-area.
2. [x] Javascript code to parse an RNG file and create Blockly blocks
3. [x] Simplification of the RNG file to produce a minimum number of
   Blockly blocks
4. [ ] Pretty naming of Blockly blocks. _Partial_
5. [ ] Javascript code to define constraints from the RNG file. _In
   progress_
6. [x] Javascript code to validate a diagram against an RNG file
7. [ ] Javascript code to export of the diagram to XML. _In progress_
8. [ ] Javascript code to import of an XML to the Blockly workspace

# RNG to Blockly mapping

Here is how RNG patterns are mapped to Blockly content.

| RNG pattern | Blockly _InputStatements_ and _Fields_ |
|---|---|
| `<text/>` | TextField (unnamed) |
| `<attribute/>` | TextField (named) |
| `<attribute> <text> ... </text> </attribute>` | TextField (named) |
| `<attribute> <data type="string"> ... </data> </attribute>`| TextField (named) + typeChecker |
| `<attribute> <choice> [values] </choice> </attribute>` | DropDown (named) |
| `<attribute> [all other cases] </attribute>` | DisplayLabel with a tree-display of all the children |
| `<element/>` | DisplayLabel |
| `<element> <text> ... </text> </element>` | TextField (named) |
| `<element> <data type="string"> ... </data> </element>` | TextField (named) + typeChecker |
| `<element> <choice> [values] </choice> </element>` | DropDown (named) |
| `<element> [all other cases] </element>` | DisplayLabel with a tree-display of all the children |
| `<group> ... </group>` | All the children stacked vertically |
| `<group name=".."> ... </group>` | DisplayLabel with a tree-display of all the children |
| `<optional> [tree with no magic block] </optional>` | CheckBox that controls a tree-display of all the children |

We call _magic tag_ the `<oneOrMore>`, `<zeroOrMore>`, `<optional>`,
`<choice>` and `interleave` tags because their content is variable and
cannot be fixed in a single block. They lead to the creation of additional
blocks. The only two exceptions are special occurrences of `<optional>` and
`<choice>` (see above).

