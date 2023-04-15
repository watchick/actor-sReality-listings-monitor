export function getIdFromUrl(url) {
    var slashPart = url.split("/");
    return slashPart[slashPart.length-1];
};
