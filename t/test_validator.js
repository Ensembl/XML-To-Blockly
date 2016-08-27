/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

phantom.injectJs("src/Validator.js");


var all_pass = true;

function assert_Validator(grammar, list, expected) {
    var v = new Validator(grammar);
    var x = v.validate(list);
    all_pass = all_pass && (expected == x);
    console.log(expected == x ? "OK" : "FAIL", JSON.stringify(list), "vs", JSON.stringify(grammar));
}

// 1. Simple cases
function test_Validator_block() {
    assert_Validator( [ "block", "A" ], [ ], false);
    assert_Validator( [ "block", "A" ], [ "A" ], true);
    assert_Validator( [ "block", "A" ], [ "B" ], false);
    assert_Validator( [ "block", "A" ], [ "A", "A" ], false);
}

// 2. Magic blocks made of simple blocks
function test_Validator_magic() {
    assert_Validator( [ "choice", [ ] ], [ ], true);
    assert_Validator( [ "choice", [ ] ], [ "A" ], false);
    assert_Validator( [ "choice", [ ["block", "A"] ] ], [ ], false);
    assert_Validator( [ "choice", [ ["block", "A"] ] ], [ "A" ], true);
    assert_Validator( [ "choice", [ ["block", "A"] ] ], [ "B" ], false);
    assert_Validator( [ "choice", [ ["block", "A"], ["block", "B"] ] ], [ ], false);
    assert_Validator( [ "choice", [ ["block", "A"], ["block", "B"] ] ], [ "A" ], true);
    assert_Validator( [ "choice", [ ["block", "A"], ["block", "B"] ] ], [ "B" ], true);
    assert_Validator( [ "choice", [ ["block", "A"], ["block", "B"] ] ], [ "C" ], false);
    assert_Validator( [ "choice", [ ["block", "A"], ["block", "B"] ] ], [ "A", "B" ], false);

    assert_Validator( [ "optional", [ ["block", "A"] ] ], [ ], true);
    assert_Validator( [ "optional", [ ["block", "A"] ] ], [ "A" ], true);
    assert_Validator( [ "optional", [ ["block", "A"] ] ], [ "B" ], false);
    assert_Validator( [ "optional", [ ["block", "A"] ] ], [ "A", "A" ], false);

    assert_Validator( [ "oneOrMore", [ ["block", "A"] ] ], [ ], false);
    assert_Validator( [ "oneOrMore", [ ["block", "A"] ] ], [ "A" ], true);
    assert_Validator( [ "oneOrMore", [ ["block", "A"] ] ], [ "B" ], false);
    assert_Validator( [ "oneOrMore", [ ["block", "A"] ] ], [ "A", "B" ], false);
    assert_Validator( [ "oneOrMore", [ ["block", "A"] ] ], [ "A", "A" ], true);
    assert_Validator( [ "oneOrMore", [ ["block", "A"] ] ], [ "A", "A", "B" ], false);

    assert_Validator( [ "zeroOrMore", [ ["block", "A"] ] ], [ ], true);
    assert_Validator( [ "zeroOrMore", [ ["block", "A"] ] ], [ "A" ], true);
    assert_Validator( [ "zeroOrMore", [ ["block", "A"] ] ], [ "B" ], false);
    assert_Validator( [ "zeroOrMore", [ ["block", "A"] ] ], [ "A", "B" ], false);
    assert_Validator( [ "zeroOrMore", [ ["block", "A"] ] ], [ "A", "A" ], true);
    assert_Validator( [ "zeroOrMore", [ ["block", "A"] ] ], [ "A", "A", "B" ], false);

    assert_Validator( [ "interleave", [ ] ], [ ], true);
    assert_Validator( [ "interleave", [ ] ], [ "A" ], false);
    assert_Validator( [ "interleave", [ ["block", "A"] ] ], [ ], false);
    assert_Validator( [ "interleave", [ ["block", "A"] ] ], [ "A" ], true);
    assert_Validator( [ "interleave", [ ["block", "A"] ] ], [ "B" ], false);
    assert_Validator( [ "interleave", [ ["block", "A"], ["block", "B"] ] ], [ ], false);
    assert_Validator( [ "interleave", [ ["block", "A"], ["block", "B"] ] ], [ "A" ], false);
    assert_Validator( [ "interleave", [ ["block", "A"], ["block", "B"] ] ], [ "B" ], false);
    assert_Validator( [ "interleave", [ ["block", "A"], ["block", "B"] ] ], [ "C" ], false);
    assert_Validator( [ "interleave", [ ["block", "A"], ["block", "B"] ] ], [ "A", "B" ], true);
    assert_Validator( [ "interleave", [ ["block", "A"], ["block", "B"] ] ], [ "B", "A" ], true);
    assert_Validator( [ "interleave", [ ["block", "A"], ["block", "B"] ] ], [ "A", "A" ], false);
    assert_Validator( [ "interleave", [ ["block", "A"], ["block", "B"] ] ], [ "B", "B" ], false);
    assert_Validator( [ "interleave", [ ["block", "A"], ["block", "B"] ] ], [ "C", "A" ], false);
    assert_Validator( [ "interleave", [ ["block", "A"], ["block", "B"] ] ], [ "A", "C" ], false);
    assert_Validator( [ "interleave", [ ["block", "A"], ["block", "B"] ] ], [ "C", "B" ], false);
    assert_Validator( [ "interleave", [ ["block", "A"], ["block", "B"] ] ], [ "B", "C" ], false);
    assert_Validator( [ "interleave", [ ["block", "A"], ["block", "B"] ] ], [ "A", "B", "A" ], false);
    assert_Validator( [ "interleave", [ ["block", "A"], ["block", "B"] ] ], [ "A", "B", "B" ], false);
    assert_Validator( [ "interleave", [ ["block", "A"], ["block", "B"] ] ], [ "B", "A", "A" ], false);
    assert_Validator( [ "interleave", [ ["block", "A"], ["block", "B"] ] ], [ "B", "A", "B" ], false);
    assert_Validator( [ "interleave", [ ["block", "A"], ["block", "B"] ] ], [ "A", "B", "C" ], false);
    assert_Validator( [ "interleave", [ ["block", "A"], ["block", "B"] ] ], [ "A", "C", "B" ], false);
}

// 3. Magic blocks made of magic blocks in an ambiguous manner
function test_Validator_magic2_ambiguous() {
    // The list matches the grammar in different ways, but all that matters is that it matches
    assert_Validator( [ "zeroOrMore", [ [ "optional", [ ["block", "A"] ] ] ] ], [ ], true);
    assert_Validator( [ "zeroOrMore", [ [ "optional", [ ["block", "A"] ] ] ] ], [ "A" ], true);
    assert_Validator( [ "zeroOrMore", [ [ "optional", [ ["block", "A"] ] ] ] ], [ "A", "A" ], true);
    assert_Validator( [ "zeroOrMore", [ [ "optional", [ ["block", "A"] ] ] ] ], [ "B" ], false);
    assert_Validator( [ "zeroOrMore", [ [ "optional", [ ["block", "A"] ] ] ] ], [ "B", "A" ], false);
    assert_Validator( [ "zeroOrMore", [ [ "optional", [ ["block", "A"] ] ] ] ], [ "A", "B" ], false);
}

// 3. Magic blocks made of magic blocks in an unambiguous manner
function test_Validator_magic2_unambiguous() {
    assert_Validator( [ "oneOrMore", [ [ "choice", [ ["block", "A"], ["block", "B" ] ] ] ] ], [ ], false);
    assert_Validator( [ "oneOrMore", [ [ "choice", [ ["block", "A"], ["block", "B" ] ] ] ] ], [ "A" ], true);
    assert_Validator( [ "oneOrMore", [ [ "choice", [ ["block", "A"], ["block", "B" ] ] ] ] ], [ "B" ], true);
    assert_Validator( [ "oneOrMore", [ [ "choice", [ ["block", "A"], ["block", "B" ] ] ] ] ], [ "C" ], false);
    assert_Validator( [ "oneOrMore", [ [ "choice", [ ["block", "A"], ["block", "B" ] ] ] ] ], [ "A", "A" ], true);
    assert_Validator( [ "oneOrMore", [ [ "choice", [ ["block", "A"], ["block", "B" ] ] ] ] ], [ "A", "B" ], true);
    assert_Validator( [ "oneOrMore", [ [ "choice", [ ["block", "A"], ["block", "B" ] ] ] ] ], [ "B", "A" ], true);
    assert_Validator( [ "oneOrMore", [ [ "choice", [ ["block", "A"], ["block", "B" ] ] ] ] ], [ "B", "A" ], true);
    assert_Validator( [ "oneOrMore", [ [ "choice", [ ["block", "A"], ["block", "B" ] ] ] ] ], [ "C", "A" ], false);
    assert_Validator( [ "oneOrMore", [ [ "choice", [ ["block", "A"], ["block", "B" ] ] ] ] ], [ "A", "C" ], false);
    assert_Validator( [ "oneOrMore", [ [ "choice", [ ["block", "A"], ["block", "B" ] ] ] ] ], [ "A", "B", "C" ], false);
    assert_Validator( [ "oneOrMore", [ [ "interleave", [ ["block", "A"], ["block", "B" ] ] ] ] ], [ ], false);
    assert_Validator( [ "oneOrMore", [ [ "interleave", [ ["block", "A"], ["block", "B" ] ] ] ] ], [ "A" ], false);
    assert_Validator( [ "oneOrMore", [ [ "interleave", [ ["block", "A"], ["block", "B" ] ] ] ] ], [ "B" ], false);
    assert_Validator( [ "oneOrMore", [ [ "interleave", [ ["block", "A"], ["block", "B" ] ] ] ] ], [ "C" ], false);
    assert_Validator( [ "oneOrMore", [ [ "interleave", [ ["block", "A"], ["block", "B" ] ] ] ] ], [ "A", "A" ], false);
    assert_Validator( [ "oneOrMore", [ [ "interleave", [ ["block", "A"], ["block", "B" ] ] ] ] ], [ "A", "B" ], true);
    assert_Validator( [ "oneOrMore", [ [ "interleave", [ ["block", "A"], ["block", "B" ] ] ] ] ], [ "B", "A" ], true);
    assert_Validator( [ "oneOrMore", [ [ "interleave", [ ["block", "A"], ["block", "B" ] ] ] ] ], [ "B", "B" ], false);
    assert_Validator( [ "oneOrMore", [ [ "interleave", [ ["block", "A"], ["block", "B" ] ] ] ] ], [ "C", "A" ], false);
    assert_Validator( [ "oneOrMore", [ [ "interleave", [ ["block", "A"], ["block", "B" ] ] ] ] ], [ "A", "C" ], false);
    assert_Validator( [ "oneOrMore", [ [ "interleave", [ ["block", "A"], ["block", "B" ] ] ] ] ], [ "A", "B", "A" ], false);
    assert_Validator( [ "oneOrMore", [ [ "interleave", [ ["block", "A"], ["block", "B" ] ] ] ] ], [ "A", "B", "B" ], false);
    assert_Validator( [ "oneOrMore", [ [ "interleave", [ ["block", "A"], ["block", "B" ] ] ] ] ], [ "B", "A", "A", "B" ], true);
    assert_Validator( [ "oneOrMore", [ [ "interleave", [ ["block", "A"], ["block", "B" ] ] ] ] ], [ "B", "A", "B", "A" ], true);
    assert_Validator( [ "oneOrMore", [ [ "interleave", [ ["block", "A"], ["block", "B" ] ] ] ] ], [ "B", "A", "A", "B", "C" ], false);
}

function test_Validator_magic_twisted() {
    var g = [ 'oneOrMore', [
               [ 'interleave', [
                  ['block', 'A'],
                  ['zeroOrMore', [
                     ['block', 'D']
                  ] ],
                  ['block', 'B'],
                  ['optional', [
                     ['block', 'C']
                  ] ],
                  ['choice', [
                     ['block', 'C'],
                     ['block', 'E']
                  ] ]
               ] ]
            ] ];
    assert_Validator(g, [ ], false);
    assert_Validator(g, [ 'A' ], false);
    assert_Validator(g, [ 'B' ], false);
    assert_Validator(g, [ 'C' ], false);
    assert_Validator(g, [ 'D' ], false);
    assert_Validator(g, [ 'E' ], false);
    assert_Validator(g, [ 'F' ], false);
    assert_Validator(g, [ 'A', 'B' ], false);
    assert_Validator(g, [ 'B', 'E' ], false);
    assert_Validator(g, [ 'C', 'A', 'B' ], true);
    assert_Validator(g, [ 'B', 'A', 'C' ], true);
    assert_Validator(g, [ 'E', 'A', 'B' ], true);
    assert_Validator(g, [ 'B', 'A', 'E' ], true);
    assert_Validator(g, [ 'C', 'A', 'E', 'B' ], true);
    assert_Validator(g, [ 'B', 'A', 'C', 'C' ], true);
    assert_Validator(g, [ 'C', 'A', 'E', 'B' ], true);
    assert_Validator(g, [ 'B', 'E', 'C', 'A' ], true);
    assert_Validator(g, [ 'C', 'D', 'A', 'E', 'B' ], true);
    assert_Validator(g, [ 'C', 'A', 'E', 'B', 'D' ], true);
    assert_Validator(g, [ 'B', 'E', 'C', 'A', 'C' ], false);
    assert_Validator(g, [ 'B', 'A', 'D', 'D', 'C', 'C' ], true);
    assert_Validator(g, [ 'B', 'A', 'D', 'D', 'C', 'C', 'E' ], false);
    assert_Validator(g, [ 'B', 'A', 'D', 'D', 'C', 'C', 'E', 'A', 'B' ], true);
    assert_Validator(g, [ 'A', 'C', 'B', 'A', 'B', 'C', 'A', 'D', 'B' ], false);
    assert_Validator(g, [ 'A', 'C', 'B', 'A', 'B', 'C', 'A', 'D', 'E', 'B' ], true);
    assert_Validator(g, [ 'A', 'C', 'D', 'D', 'B', 'A', 'B', 'C', 'C', 'A', 'E', 'C', 'D', 'B' ], true);
    assert_Validator(g, [ 'A', 'C', 'D', 'D', 'B', 'A', 'B', 'C', 'C', 'A', 'E', 'C', 'D', 'B', 'A' ], false);
    assert_Validator(g, [ 'A', 'C', 'D', 'D', 'B', 'A', 'B', 'C', 'C', 'A', 'E', 'C', 'D', 'F', 'B' ], false);
}

function test_Validator_magic_twisted2() {
    var g = [ 'interleave', [
               ['block', 'first'],
               ['block', 'second'],
               ['block', 'third'],
               [ 'interleave', [
                  ['block', 'a'],
                  ['block', 'b'],
                  ['block', 'c'],
                  ['block', 'common'],
               ] ],
               [ 'interleave', [
                  ['block', 'common'],
                  ['block', 'ch_1'],
                  ['block', 'ch_2'],
                  ['block', 'ch_3'],
               ] ]
            ] ];
    assert_Validator(g, [ "first", "second", "third", "ch_1", "ch_2", "ch_3", "common", "a", "b", "c", "common" ], true);
}

test_Validator_block();
test_Validator_magic();
test_Validator_magic2_ambiguous();
test_Validator_magic2_unambiguous();
test_Validator_magic_twisted();
test_Validator_magic_twisted2();

phantom.exit(all_pass ? 0 : 1);

