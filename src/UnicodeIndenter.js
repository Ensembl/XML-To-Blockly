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

/*
 * This object keeps a stack of "last-ness" indicators with methods to add
 * and remove one. A tree indenter can be drawn from the information.  Here
 * is an example of how the stack elements are used to produce the
 * indentation:
 *
 * []             -> ""
 * [false]        -> "┣━━"
 * [false, false] -> "┃   ┣━━"
 * [false, true]  -> "┃   ┗━━"
 * [true]         -> "┗━━"
 * [true, false]  -> "    ┣━━"
 * [true, true]   -> "    ┗━━"
 *
 * The last element of the list is treated in a special manner, producing
 * the T-shape character and the corner character. Previous elements of the
 * list only pad the string with white space or a vertical bar.
 *
 */

function UnicodeIndenter() {
    this.indentation = [];
}

UnicodeIndenter.prototype.reset = function() {
    this.indentation = [];
}

UnicodeIndenter.prototype.indent = function(is_last) {
    this.indentation.push(is_last);
}

UnicodeIndenter.prototype.unindent = function() {
    if (this.indentation.length > 0) {
        return this.indentation.pop();
    }
}

UnicodeIndenter.prototype.getIndentation = function() {
    var ind = "";
    for(var i=0; i<(this.indentation.length-1); i++) {
        ind += (this.indentation[i] ? "        " : "\u2503       ");
    }
    if (this.indentation.length > 0) {
        ind += (this.indentation[ this.indentation.length - 1 ] ? "\u2517\u2501\u2501 " : "\u2523\u2501\u2501 ");
    }
    return ind;
}

function test_UnicodeIndenter() {
    var un = new UnicodeIndenter();
    console.log( un.getIndentation() );

    un.indent(false);
    console.log( un.getIndentation() );
    un.unindent();

    un.indent(true);
    console.log( un.getIndentation() );
    un.unindent();

    un.indent(false);
    un.indent(false);
    console.log( un.getIndentation() );
    un.unindent();
    un.unindent();

    un.indent(false);
    un.indent(true);
    console.log( un.getIndentation() );
    un.unindent();
    un.unindent();

    un.indent(true);
    un.indent(true);
    console.log( un.getIndentation() );
    un.unindent();
    un.unindent();

    un.indent(true);
    un.indent(false);
    console.log( un.getIndentation() );
    un.unindent();
    un.unindent();
}

