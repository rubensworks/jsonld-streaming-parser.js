# Changelog
All notable changes to this project will be documented in this file.

<a name="v2.0.0"></a>
## [v2.0.0](https://github.com/rubensworks/streaming-jsonld-parser.js/compare/v1.1.2...v2.0.0) - 2020-04-03

### Added
* Add [JSON-LD 1.1](https://www.w3.org/TR/json-ld11/) support:
    * [Refactor list handling to allow nested lists in 1.1](https://github.com/rubensworks/streaming-jsonld-parser.js/commit/b5eee80d666bec1bf83d52411eeec6fef90fa91f)
    * [Handle property-scoped contexts in raw property values](https://github.com/rubensworks/streaming-jsonld-parser.js/commit/b580a75a9a8ac881298ee56e4e2dccfc780d1d93)
    * [Handle property-based indexing with graph containers](https://github.com/rubensworks/streaming-jsonld-parser.js/commit/494d1cf6bbb3c1ddc84910e95b42d1781bbfd953)
    * [Handle @type: @id in property-based index containers](https://github.com/rubensworks/streaming-jsonld-parser.js/commit/462d790713338aee7f9a195542cc5b99153dff48)
    * [Handle property-based indexing](https://github.com/rubensworks/streaming-jsonld-parser.js/commit/107341e430dbb021b1995b69e678081e31acd381)
    * [Allow context nullification in scoped ctx to clear protections](https://github.com/rubensworks/streaming-jsonld-parser.js/commit/20c6834502fa4f57aceeb827ae328b0f2d8b8ed0)
    * [Allow protected term overrides in property-scoped contexts](https://github.com/rubensworks/streaming-jsonld-parser.js/commit/90de7244f6da54708b039194cf0032415694eeaa)
    * [Handle out-of-order type-scoped contexts](https://github.com/rubensworks/streaming-jsonld-parser.js/commit/3cab29ed4a2db89aac34145de0eaf515cd3ea59d)
    * [Handle propagation on type-scoped contexts](https://github.com/rubensworks/streaming-jsonld-parser.js/commit/20d2ef2ce255276206f36c03b9f19f611090737c)
    * [Handle embedded contexts with disabled propagation](https://github.com/rubensworks/streaming-jsonld-parser.js/commit/0e6a33d5feb0e160353106aba18be07b6e7aa471)
    * [Handle (in-order) type-scoped contexts](https://github.com/rubensworks/streaming-jsonld-parser.js/commit/d2fce0e4dcbee2c30b4a67714b40379aedbd9b37)
    * [Handle @propagate in prop-scoped contexts](https://github.com/rubensworks/streaming-jsonld-parser.js/commit/03b377fddcc21e4cf27d7ade5e0e8bf9fb78ac0b)
    * [Handle property-scoped contexts](https://github.com/rubensworks/streaming-jsonld-parser.js/commit/3128a1d54d664bc8e92634e360cbf52e360523b8)
    * [Handle @graph-@id and @graph-@index containers](https://github.com/rubensworks/streaming-jsonld-parser.js/commit/20e73d5d7e35797f0c3fef627220a9b055a6547a)
    * [Handle @type on type maps with string values](https://github.com/rubensworks/streaming-jsonld-parser.js/commit/d9bd662c65327ce990509df9e7ba2d1da41af1aa)
    * [Handle type maps with string values](https://github.com/rubensworks/streaming-jsonld-parser.js/commit/40cfe5086f46c8065a5cc6ac94dd270d74cf1c56)
    * [Handle @type: @none](https://github.com/rubensworks/streaming-jsonld-parser.js/commit/c2836a3342d213b1cfacfed529a67bf4d7aea0ca)
    * [Handle @none in containers](https://github.com/rubensworks/streaming-jsonld-parser.js/commit/c9837c4138484104e8ebfb0ec3e757f43a8ded35)
    * [Ignore @nest properties in the stack](https://github.com/rubensworks/streaming-jsonld-parser.js/commit/5e011659ac0b5120881c3df631c4c69cd6375fbe)
    * [Handle graph containers](https://github.com/rubensworks/streaming-jsonld-parser.js/commit/5a8bc072142bf60e38ae1e6094dc9efb0678cccf)
    * [Handle type containers](https://github.com/rubensworks/streaming-jsonld-parser.js/commit/d4783104011708aa0d9750e5479488ff6bf28d65)
    * [Parse @type: @json as JSON string literals](https://github.com/rubensworks/streaming-jsonld-parser.js/commit/fcf87500e013277b3a175503b0b517165cdb7e22)
    * [Add option to normalize language tags in 1.1](https://github.com/rubensworks/streaming-jsonld-parser.js/commit/1b1e95fd34e1a92bea778b5085548536c162e59c)
    * [Handle @direction under the different rdfDirection modes](https://github.com/rubensworks/streaming-jsonld-parser.js/commit/0b7ae17870cd00c2739d2e6f96b03bdc76a90020)
    * [Add support for @prefix terms](https://github.com/rubensworks/streaming-jsonld-parser.js/commit/e74b755905f7981e8cc78f1f3f36e64ca3654d00)
* Handle [JSON-LD 1.1 Streaming Profile](https://w3c.github.io/json-ld-streaming/):
    * [Detect and handle streaming profile in content type header](https://github.com/rubensworks/streaming-jsonld-parser.js/commit/8132bd647af4bb0354c07c01299d3eebd151e944)
* [Expose fromHttpResponse helper function](https://github.com/rubensworks/streaming-jsonld-parser.js/commit/7b1efa1b2cd650a0598eb3876f9d25c473ef1577)
* [Implement RDF.Sink interface, Closes #50](https://github.com/rubensworks/streaming-jsonld-parser.js/commit/815459a05ecdd9eb26cf0df3d679e019db84fe94)

### Changed
* [Add streamingProfile flag that is disabled by default](https://github.com/rubensworks/streaming-jsonld-parser.js/commit/410a8b661e5c1e450480df49b342fbc8fc8a0234)
* [Align params on validation with strictValues](https://github.com/rubensworks/streaming-jsonld-parser.js/commit/521e887d2ea44e8e4a3b4d377331fa067b1937b4)
* [Simplify array handling of type keywords](https://github.com/rubensworks/streaming-jsonld-parser.js/commit/ba018c724fd8e31236c0fbb74f162ebeae8c823c)
* [Refactor architecture to support multiple objects from values](https://github.com/rubensworks/streaming-jsonld-parser.js/commit/7f3610ce3602c6aa0099a2f1835ef5088d45dff4)
* [Only apply language tag lowercasing in 1.0](https://github.com/rubensworks/streaming-jsonld-parser.js/commit/044bd3318c7ce427781351646afa4039ffaf0686)
* [Interpret ints >=1e21 as doubles](https://github.com/rubensworks/streaming-jsonld-parser.js/commit/dc50fdcd3b54f4466c0e5ba418305fb5260e39d2)
* [Validate language tags](https://github.com/rubensworks/streaming-jsonld-parser.js/commit/318e3e623541d17b815bfbc44e890574c96c6fb9)
* [Ignore instead of error on invalid compact IRIs](https://github.com/rubensworks/streaming-jsonld-parser.js/commit/8bc5c15b6eb8c70cf970c34e56d4eb285f198df2)

<a name="v1.1.2"></a>
## [v1.1.2](https://github.com/rubensworks/streaming-jsonld-parser.js/compare/v1.1.1...v1.1.2) - 2019-10-22

### Changed
* [Ensure lowercased language tags](https://github.com/rubensworks/streaming-jsonld-parser.js/commit/1214db9e0f4f3614d54bc7e5bd15f797fddd4202)

### Fixed
* [Fix inner contexts sometimes overriding each other, Closes #33](https://github.com/rubensworks/streaming-jsonld-parser.js/commit/c4716bef5583dec880e20439260548bbdc563b25)

<a name="v1.1.1"></a>
## [v1.1.1](https://github.com/rubensworks/streaming-jsonld-parser.js/compare/v1.1.0...v1.1.1) - 2019-09-18

### Fixed
* [Bump to jsonld-context-parser to fix spec failures](https://github.com/rubensworks/streaming-jsonld-parser.js/commit/2ddcf7122f6ac806050c1fc07fc5ea066eae3d9b)
* [Fix @id and @type on terms incorrectly converting native values to URIs](https://github.com/rubensworks/streaming-jsonld-parser.js/commit/6a086253882d557fc232e8383a25d7979357a545)

<a name="v1.1.0"></a>
## [v1.1.0](https://github.com/rubensworks/streaming-jsonld-parser.js/compare/v1.0.1...v1.1.0) - 2019-04-02

### Added
* [Emit detected contexts via 'context' event](https://github.com/rubensworks/streaming-jsonld-parser.js/commit/a56c1e433072020a999a5595949b89681c378d76)

<a name="v1.0.1"></a>
## [v1.0.1](https://github.com/rubensworks/streaming-jsonld-parser.js/compare/v1.0.0...v1.0.1) - 2019-02-13

### Fixed
* [Fix validity of @type's not being checked](https://github.com/rubensworks/streaming-jsonld-parser.js/commit/1b119258c642befdd5b0907fb7d757551332c0ce)

<a name="v1.0.0"></a>
## [v1.0.0] - 2019-02-07

Initial release
