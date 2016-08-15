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
 * This validator is defined by a grammar, which is
 *    grammar : [ "block", string ]
 *            | [ "zeroOrMore" | "oneOrMore" | "optional", list of 1 grammar element ]
 *            | [ "choice" | "interleave", list of grammar elements  ]
 *
 * Example: [ 'oneOrMore', [
 *             [ 'interleave', [
 *                ['block', 'A'],
 *                ['zeroOrMore', [
 *                   ['block', 'D']
 *                ] ],
 *                ['block', 'B'],
 *                ['optional', [
 *                   ['block', 'C']
 *                ] ],
 *                ['choice', [
 *                   ['block', 'C'],
 *                   ['block', 'E']
 *                ] ]
 *             ] ]
 *          ] ];
 *
 * The grammar is to be validated against a list of block names like:
 *    [ 'A', 'C', 'B', 'A', 'B', 'C', 'A', 'D', 'E', 'B' ],
 *
 * The validator is a function that reads the list and tries to match it
 * against the grammar. A list is validated only if it entirely matches the
 * entire grammar. For instance, ['A', 'B'] does not match ['block', A']
 *
 * Validator is the object that will do the recursion.  Validator
 * implements a validator per magic_name and a dispatcher that calls the
 * right _validate method for the current magic_name.  It uses
 * ValidatorResult as an intermediate way of storing the matches.
 * ValidatorResult contains the first index of the list that is not yet
 * matched.  For instance, if we've validated the first two elements of a
 * list, _indexes will be [2]. The validator may then try to extend the
 * validation for position 2 onwards. _indexes is empty if nothing has
 * matched. The list is considered fully validated if _indexes contains the
 * end-of-list position.
 * The recursion is depth first, with an option to end it as soon as we've
 * found a full match.
 *
 */


/* *************
 * Structure that holds the result of the validator.
 * *************/

function ValidatorResult() {
    this._indexes_lookup = {};  // To keep distinct indexes
    this._indexes = [];         // All the keys in the object are transformed to string, so we keep the integers in this list
    Array.prototype.slice.call(arguments).map(this.addIndex, this);     // Extra constructor parameters are assumed to be indexes to add
}

// The validation is a success if _indexes is not empty
ValidatorResult.prototype.pass = function() {
    return this._indexes.length > 0;
};

// getter to protect the internal variable
ValidatorResult.prototype.getIndexes = function() {
    // Returns a copy to make sure the caller doesn't modify our internal structure
    return this._indexes.slice();
};

// add a new index to the list, avoiding repetitions
ValidatorResult.prototype.addIndex = function(i) {
    if (!(i in this._indexes_lookup)) {
        this._indexes_lookup[i] = 1;
        this._indexes.push(i);
    }
    return this;
};

// wrapper around addIndex to add all the indexes of a ValidatorResult into another
ValidatorResult.prototype.blendWithResult = function(r) {
    r.getIndexes().map(this.addIndex, this);
    return this;
};

// string representation
ValidatorResult.prototype.toString = function() {
    return "ValidatorResult: " + (this.pass() ? "pass at indexes " + JSON.stringify(this.getIndexes()) : "fail");
};


/* *************
 * Structure that holds a validator.
 * It is initialized with a grammar and has a validate() method that checks
 * whether the given list matches the grammar
 * *************/

function Validator(grammar) {
    this._grammar = grammar;
}

Validator.prototype.validate = function(list) {
    this._list = list;
    this._indent = "";
    this._cache = {};
    var x = this._pair_dispatcher(this._grammar, 0, true);
    return this.isFullyValidated(x);
};

// Helper method to check whether the whole list has been validated by a ValidatorResult
Validator.prototype.isFullyValidated = function(r) {
    return (this._list.length in r._indexes_lookup);
};

// Returns the simplest instance of a ValidatorResult that reports that the
// list is fully validated. This is used to discard partial matches and
// prune parts of the search tree (some kind of branch-and-bound approach)
Validator.prototype.bestResult = function(r) {
    return new ValidatorResult(this._list.length);
};

// Helper method to print indented debug statements to the console
Validator.prototype.debug = function() {
    var args = Array.prototype.slice.call(arguments);
    args.unshift(this._indent);
    Function.apply.call(console.log, console, args);
};

Validator.prototype._validate_block = function(content, i, mustUseAll) {
    // We can assume that content is a string
    if (i == this._list.length) {
        this.debug("!", "exhausted");
        return new ValidatorResult();
    } else if (this._list[i] == content) {
        return new ValidatorResult(i+1);
    } else {
        return new ValidatorResult();
    }
};

Validator.prototype._validate_oneOrMore = function(content, i, mustUseAll) {
    // We can assume that content is a list with a single element
    var result = new ValidatorResult();
    var indexes_to_test = [i];
    var indexes_tested = {};
    while (indexes_to_test.length > 0) {
        var j = indexes_to_test.shift();
        if (j in indexes_tested) {
            continue;
        }
        indexes_tested[j] = 1;
        var x = this._pair_dispatcher(content[0], j, mustUseAll);
        if (mustUseAll && this.isFullyValidated(x)) {
            // quick bail-out
            return this.bestResult();
        } else if (x.pass()) {
            result.blendWithResult(x);
            Array.prototype.push.apply(indexes_to_test, x.getIndexes());
        }
    }
    return result;
};

Validator.prototype._validate_zeroOrMore = function(content, i, mustUseAll) {
    // Don't bother with the empty match in mustUseAll mode
    if (mustUseAll) {
        if (i == this._list.length) {
            // quick bail-out
            return this.bestResult();
        }
        return this._named_dispatcher("oneOrMore", content, i, true);
    }
    // zeroOrMore always matches, but we need to call validate_oneOrMore
    // too to check for potential repetitions
    var result = new ValidatorResult(i);
    var x = this._named_dispatcher("oneOrMore", content, i, false);
    result.blendWithResult(x);
    return result;
};

Validator.prototype._validate_optional = function(content, i, mustUseAll) {
    // Don't bother with the empty match in mustUseAll mode
    if (mustUseAll) {
        if (i == this._list.length) {
            // quick bail-out
            return this.bestResult();
        }
        return this._pair_dispatcher(content[0], i, true);
    }
    // We can assume that content is a list with a single element
    var result = new ValidatorResult(i);
    var x = this._pair_dispatcher(content[0], i, false);
    result.blendWithResult(x);
    return result;
};

Validator.prototype._validate_choice = function(content, i, mustUseAll) {
    if (content.length == 0) {
        return new ValidatorResult(i);
    }
    // Simply test each element of content
    var result = new ValidatorResult();
    for(var ind=0; ind<content.length; ind++) {
        var x = this._pair_dispatcher(content[ind], i, mustUseAll);
        if (mustUseAll && this.isFullyValidated(x)) {
            // quick bail-out
            return this.bestResult();
        }
        result.blendWithResult(x);
    }
    return result;
};

Validator.prototype._validate_interleave = function(content, i, mustUseAll) {
    if (content.length == 0) {
        return new ValidatorResult(i);
    } else if (content.length == 1) {
        // Trivial interleave, defer
        return this._pair_dispatcher(content[0], i, mustUseAll);
    }
    // We try to validate each element
    var result = new ValidatorResult();
    for(var ind=0; ind<content.length; ind++) {
        var x = this._pair_dispatcher(content[ind], i, false);
        if (x.pass()) {
            // Whenever there is a match we try to validate an interleave made of the remaining elements
            var new_content = JSON.parse(JSON.stringify(content));
            new_content.splice(ind, 1);
            var all_indexes = x.getIndexes();
            for(var ind2=0; ind2<all_indexes.length; ind2++) {
                var y = this._named_dispatcher("interleave", new_content, all_indexes[ind2], mustUseAll);
                if (mustUseAll && this.isFullyValidated(y)) {
                    // quick bail-out
                    return this.bestResult();
                }
                result.blendWithResult(y);
            }
        }
    }
    return result;
};

// Choose the appropriate _validate_* method based on magic_name
// Results are memoized into this._cache to avoid repeating the same validation.
// The _validate_* methods could be calling each other, but they rather come back
// to the dispatcher which ensures that we're not repeating the same calls.
Validator.prototype._named_dispatcher = function(magic_name, content, i, mustUseAll) {
    this.debug(">", magic_name, JSON.stringify(content), i);

    var key = JSON.stringify(Array.prototype.slice.call(arguments));
    if (key in this._cache) {
        this.debug("!", "cached", this._cache[key].toString());
        return this._cache[key];
    }

    var back_indent = this._indent;
    this._indent = this._indent + "  ";

    var f = {
        "block": this._validate_block,
        "oneOrMore": this._validate_oneOrMore,
        "zeroOrMore": this._validate_zeroOrMore,
        "optional": this._validate_optional,
        "choice": this._validate_choice,
        "interleave": this._validate_interleave
    }[magic_name];
    var x = f.call(this, content, i, mustUseAll);

    if (mustUseAll && this.isFullyValidated(x)) {
        x = this.bestResult();
    }

    this._indent = back_indent;
    this.debug("<", x.toString());
    this._cache[key] = x;
    return x;
};

// Wrapper around _named_dispatcher that understands pairs (array) like (magic_name, content)
Validator.prototype._pair_dispatcher = function(pair, i, mustUseAll) {
    return this._named_dispatcher(pair[0], pair[1], i, mustUseAll);
};

function assert_Validator(grammar, list, expected) {
    var v = new Validator(grammar);
    var x = v.validate(list);
    console.log(expected == x ? "OK" : "FAIL", JSON.stringify(list), "vs", JSON.stringify(grammar));
}

