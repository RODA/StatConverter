#!/usr/bin/env node

function normalizeSemverLike(version) {
  const match = /^([0-9]+)\.([0-9]+)\.([0-9]+)(.*)$/.exec(version);

  if (!match) {
    return version;
  }

  const [, major, minor, patch, suffix] = match;
  return `${Number(major)}.${Number(minor)}.${Number(patch)}${suffix}`;
}

function getVersionInfo() {
  const pkg = require('../package.json');
  const rawVersion = pkg.version;

  return {
    rawVersion,
    normalizedVersion: normalizeSemverLike(rawVersion)
  };
}

module.exports = {
  getVersionInfo,
  normalizeSemverLike
};