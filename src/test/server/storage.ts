import {AbstractStorage, UrlHandler} from "../../server/storage";
import {should, expect} from 'chai';

describe("Storage", function () {
  describe("UrlHandler", function () {
    describe("prepareForOuterWorld", function () {
      it("should not touch non-file urls", function () {
        expect(UrlHandler.prepareForOuterWorld('http://example.com/file.pdf', 'my.host')).to.be.equal('http://example.com/file.pdf');
      });

      it("should convert an url pointing to a local file to a remote one", function () {
        expect(UrlHandler.prepareForOuterWorld('file:///some/location.pdf', 'my.host')).to.be.equal('organelle://my.host/some/location.pdf');
      });

      it("should not touch file urls pointing to another server", function () {
        expect(UrlHandler.prepareForOuterWorld('file://example.com/file.pdf', 'my.host')).to.be.equal('file://example.com/file.pdf');
      });
    });

    describe("resolve", function () {
      it("should not modify non-file urls", function () {
        expect(UrlHandler.resolve('http://example.com/file.pdf', '/root/path')).to.be.equal('http://example.com');
      });

      it("should not modify urls that encapsulate an absolute path", function () {
        expect(UrlHandler.resolve('file:///some/location.pdf', '/root/path')).to.be.equal('file:///some/location.pdf');
        expect(UrlHandler.resolve('file:///C:/some/location.pdf', 'E:/root/path')).to.be.equal('file:///C:/some/location.pdf');
        expect(UrlHandler.resolve('file:///C:/some/location.pdf', '/root/path')).to.be.equal('file:///C:/some/location.pdf');
        expect(UrlHandler.resolve('file://some.host/C:/some/location.pdf',
            '/root/path')).to.be.equal('file://some.host/C:/some/location.pdf');
        expect(UrlHandler.resolve('/some/location.pdf', '/root/path')).to.be.equal('file:///some/location.pdf');
        expect(UrlHandler.resolve('C:/some/location.pdf', '/root/path')).to.be.equal('file:///C:/location.pdf');
      });

      it("should handle UNC paths", function () {
        expect(UrlHandler.resolve('\\\\example.com\\some\\location.pdf', '/root/path')).to.be.equal('file://example.com/some/location.pdf');
      });

      it("should resolve relative file urls", function () {
        expect(UrlHandler.resolve('some/location.pdf', '/root/path')).to.be.equal('file:///root/path/some/location.pdf');
      });
    });

    describe("normalize", function () {
      it("should normalize file paths", function () {
        expect(UrlHandler.normalize('file:///some//nested\\location.pdf')).to.be.equal('file:///some/nested/location.pdf');
        expect(UrlHandler.normalize('file:///some//nested\\location.pdf')).to.be.equal('file://some/nested/location.pdf');
        expect(UrlHandler.normalize('file://example.com/some/nested/location.pdf')).to.be.equal('file://example.com/some/nested/location.pdf');
      });
    });

    describe("fromPath", function () {
      it("should make simple file urls", function () {
        expect(UrlHandler.fromPath('/some/location.pdf')).to.be.equal('file:///some/location.pdf');
        expect(UrlHandler.fromPath('C:/some/location.pdf')).to.be.equal('file:///C:/some/location.pdf');
      });

      it("should throw when path is relative", function () {
        expect(() => UrlHandler.fromPath('some/location.pdf')).to.throw();
      });

      it("should make file urls with a host", function () {
        expect(UrlHandler.fromPath('/some/location.pdf', 'example.com')).to.be.equal('file://example.com/some/location.pdf');
        expect(UrlHandler.fromPath('C:/some/location.pdf', 'example.com')).to.be.equal('file://example.com/C:/some/location.pdf');
      });

      it("should escape special characters", function () {
        expect(UrlHandler.fromPath('/to.be.or.not.to.be?.pdf')).to.be.equal('file:///to.be.or.not.to.be%3F.pdf');
      });

      it("should make file urls from UNC paths", function () {
        expect(UrlHandler.fromPath('\\\\example.com\\some\\location.pdf')).to.be.equal('file://example.com/some/location.pdf');
      });
    });

    describe("toPath", function () {
      it("should extract simple paths", function () {
        expect(UrlHandler.toPath('file:///some/location.pdf')).to.be.deep.equal({
          host: '',
          path: '/some/location.pdf'
        });
      });

      it("should decode special characters", function () {
        expect(UrlHandler.toPath('file:///to.be.or.not.to.be?.pdf')).to.be.deep.equal({
          host: '',
          path: '/to.be.or.not.to.be?.pdf'
        });
      });

      it("should extract host", function () {
        expect(UrlHandler.toPath('file://example.com/some/location.pdf')).to.be.deep.equal({
          host: 'example.com',
          path: '/some/location.pdf'
        });
      });

      it("should throw when url has no file protocol", function () {
        expect(() => UrlHandler.toPath('http://example.com/location.pdf')).to.throw();
      });
    });
  });
});
