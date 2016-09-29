[![Build Status](https://travis-ci.org/Ensembl/XML-To-Blockly.svg?branch=gh-pages)](https://travis-ci.org/Ensembl/XML-To-Blockly)

# Introduction

This [project](https://ensembl.github.io/XML-To-Blockly/) is funded by the 2016 edition of the [Google Summer of Code program](https://summerofcode.withgoogle.com/).
[Anuj Khandelwal](https://github.com/anujk14/) has been selected to work on a [Graphical workflow editor for eHive using Blockly](https://summerofcode.withgoogle.com/projects/#5041231054766080) in the [Ensembl Genomes Browser](https://summerofcode.withgoogle.com/organizations/6373155673210880/) organization under the supervision of [Matthieu Muffato](https://www.ebi.ac.uk/~muffato/) and [Leo Gordon](https://github.com/ens-lg4/).

[eHive](https://github.com/Ensembl/ensembl-hive) is a system used to run computation pipelines in distributed environments.
Currently the eHive workflows are configured in a specific file format that requires basic programming skills.
This project aims at removing this drawback by creating a graphical editor for eHive workflows using Google's [Blockly](https://developers.google.com/blockly/) library.

We are envisaging XML as the file format, with a [Relax NG specification](http://relaxng.org/spec-20011203.html).
The backbone of this graphical editor would be an automated conversion of a Relax NG specification to Blockly blocks and matching rules so that the Blockly diagrams conform to the specification.
The graphical interface will have to be able to import existing XML files to visualize them in terms of Blockly blocks, edit them, and export the diagram back to XML.

The project submitted to Google is not specific to eHive and the proposed editor should be able of handling any specifications written using the Relax NG schema.

# How to use

1. Open https://ensembl.github.io/XML-To-Blockly/ in your web browser.
2. Click on the 'Choose file' and open a Relax NG file. This will create a list of blocks in the toolbox.
3. Play with the blocks to create a diagram that follows the specification.

# Current state

1. [x] Web page with a Blockly workspace, an RNG text-area and an XML
   text-area.
2. [x] Javascript code to parse an RNG file and create Blockly blocks
3. [x] Simplification of the RNG file to produce a minimum number of
   Blockly blocks
4. [x] Pretty naming of Blockly blocks.
5. [x] Blockly rules to allow the right connections between blocks
6. [x] Extra validator for the constraints that cannot be modeled in
   Blockly
7. [x] Javascript code to export of the diagram to XML.
8. [ ] Javascript code to import of an XML to the Blockly workspace

# Supported RNG elements

This table lists the XML patterns from http://relaxng.org/spec-20011203.html that are understood by the parser

|  |  | XML pattern | Supported ? |
|---|---|---|---|
| pattern | ::= | \<element name="QName"> pattern+ \</element> | :white_check_mark: |
|         |     | \| \<element> nameClass pattern+ \</element> | :white_check_mark: (only \<name> QName \</name> is supported) |
|         |     | \| \<attribute name="QName"> [pattern] \</attribute> | :white_check_mark: |
|         |     | \| \<attribute> nameClass [pattern] \</attribute> | :white_check_mark: (only \<name> QName \</name> is supported) |
|         |     | \| \<group> pattern+ \</group> | :white_check_mark: |
|         |     | \| \<interleave> pattern+ \</interleave> | :white_check_mark: |
|         |     | \| \<choice> pattern+ \</choice> | :white_check_mark: |
|         |     | \| \<optional> pattern+ \</optional> | :white_check_mark: |
|         |     | \| \<zeroOrMore> pattern+ \</zeroOrMore> | :white_check_mark: |
|         |     | \| \<oneOrMore> pattern+ \</oneOrMore> | :white_check_mark: |
|         |     | \| \<list> pattern+ \</list> | :x: |
|         |     | \| \<mixed> pattern+ \</mixed> | :x: |
|         |     | \| \<ref name="NCName"/> | :white_check_mark: |
|         |     | \| \<parentRef name="NCName"/> | :x: |
|         |     | \| \<empty/> | :x: |
|         |     | \| \<text/> | :white_check_mark: |
|         |     | \| \<value [type="NCName"]> string \</value> | :x: |
|         |     | \| \<data type="NCName"> param* [exceptPattern] \</data> | :white_check_mark: (some, see below)|
|         |     | \| \<notAllowed/> | :x: |
|         |     | \| \<externalRef href="anyURI"/> | :x: |
|         |     | \| \<grammar> grammarContent* \</grammar> | :white_check_mark: |
| param	|  ::=  |	\<param name="NCName"> string \</param> | :x: |
| exceptPattern	|  ::= | 	\<except> pattern+ \</except> | :x: |
| grammarContent	|  ::=  |	start | :white_check_mark: |
|         |     | \| define | :white_check_mark: |
|         |     | \| \<div> grammarContent* \</div> | :x: |
|         |     | \| \<include href="anyURI"> includeContent* \</include> | :x: |
| includeContent	|  ::= | 	start | :x: |
|         |     | \| define | :x: |
|         |     | \| \<div> includeContent* \</div> | :x: |
| start	|  ::=  |	\<start [combine="method"]> pattern \</start> | :white_check_mark: (but not the _combine_ option) |
| define	 | ::=  |	\<define name="NCName" [combine="method"]> pattern+ \</define> | :white_check_mark: |
| method	|  ::= | 	choice | :x: |
|         |     | \| interleave | :x: |
| nameClass	 | ::=  |	\<name> QName \</name> | :white_check_mark: |
|         |     | \| \<anyName> [exceptNameClass] \</anyName> | :x: |
|         |     | \| \<nsName> [exceptNameClass] \</nsName> | :x: |
|         |     | \| \<choice> nameClass+ \</choice> | :x: |
| exceptNameClass	 | ::=  |	\<except> nameClass+ \</except> | :x: |

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
