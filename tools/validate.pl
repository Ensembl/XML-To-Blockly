#!/usr/bin/env perl
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
# 
#      http://www.apache.org/licenses/LICENSE-2.0
# 
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.


use strict;
use warnings;
use XML::LibXML;

unless(scalar(@ARGV) == 2) {
    die "Usage:\n\t$0 <xml_file> <schema_file.xsd|schema_file.rng>\n";
}

my ($xml_file, $schema_file) = @ARGV;

my $class = ($schema_file=~/.rng$/) ? 'RelaxNG' : 'Schema';

my $schema = "XML::LibXML::$class"->new(location => $schema_file);
my $parser = XML::LibXML->new(line_numbers => 1);

my $dom = $parser->parse_file($xml_file);
eval { $schema->validate( $dom ) };

if($@) {
    print "$class validation failed:\n$@\n";
} else {
    print "$class validation succeeded\n";
}

