export function encodeBase64(input: string): string {
    // encode utf-8 -> percent-encoding -> bytes -> btoa
    return btoa(
        encodeURIComponent(input).replace(/%([0-9A-F]{2})/g, (_, p1) =>
            String.fromCharCode(parseInt(p1, 16)),
        ),
    );
}

export function b64DecodeUnicode(str: string) {
    return decodeURIComponent(
        atob(str)
            .split("")
            .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
            .join(""),
    );
}