import fs from 'node:fs';
import { StreamType } from '../YouTube/stream';
import { request } from '../Request';
import { SoundCloudPlaylist, SoundCloudTrack, SoundCloudTrackFormat, Stream } from './classes';

let soundData: SoundDataOptions;
if (fs.existsSync('.data/soundcloud.data')) {
    soundData = JSON.parse(fs.readFileSync('.data/soundcloud.data').toString());
}

interface SoundDataOptions {
    client_id: string;
}

const pattern = /^(?:(https?):\/\/)?(?:(?:www|m)\.)?(api\.soundcloud\.com|soundcloud\.com|snd\.sc)\/(.*)$/;
/**
 * Function to get info from a soundcloud url
 * @param url soundcloud url
 * @returns SoundCloud Track or SoundCloud Playlist
 */
export async function soundcloud(url: string): Promise<SoundCloud> {
    if (!soundData) throw new Error('SoundCloud Data is missing\nDid you forgot to do authorization ?');
    if (!url.match(pattern)) throw new Error('This is not a SoundCloud URL');

    const data = await request(
        `https://api-v2.soundcloud.com/resolve?url=${url}&client_id=${soundData.client_id}`
    ).catch((err: Error) => err);

    if (data instanceof Error) throw data;

    const json_data = JSON.parse(data);

    if (json_data.kind !== 'track' && json_data.kind !== 'playlist')
        throw new Error('This url is out of scope for play-dl.');

    if (json_data.kind === 'track') return new SoundCloudTrack(json_data);
    else return new SoundCloudPlaylist(json_data, soundData.client_id);
}
/**
 * Type of SoundCloud
 */
export type SoundCloud = SoundCloudTrack | SoundCloudPlaylist;
/**
 * Function for searching in SoundCloud
 * @param query query to search
 * @param type 'tracks' | 'playlists' | 'albums'
 * @param limit max no. of results
 * @returns Array of SoundCloud type.
 */
export async function so_search(
    query: string,
    type: 'tracks' | 'playlists' | 'albums',
    limit: number = 10
): Promise<SoundCloud[]> {
    const response = await request(
        `https://api-v2.soundcloud.com/search/${type}?q=${query}&client_id=${soundData.client_id}&limit=${limit}`
    );
    const results: (SoundCloudPlaylist | SoundCloudTrack)[] = [];
    const json_data = JSON.parse(response);
    json_data.collection.forEach((x: any) => {
        if (type === 'tracks') results.push(new SoundCloudTrack(x));
        else results.push(new SoundCloudPlaylist(x, soundData.client_id));
    });
    return results;
}
/**
 * Main Function for creating a Stream of soundcloud
 * @param url soundcloud url
 * @param quality Quality to select from
 * @returns SoundCloud Stream
 */
export async function stream(url: string, quality?: number): Promise<Stream> {
    const data = await soundcloud(url);

    if (data instanceof SoundCloudPlaylist) throw new Error("Streams can't be created from Playlist url");

    const HLSformats = parseHlsFormats(data.formats);
    if (typeof quality !== 'number') quality = HLSformats.length - 1;
    else if (quality <= 0) quality = 0;
    else if (quality >= HLSformats.length) quality = HLSformats.length - 1;
    const req_url = HLSformats[quality].url + '?client_id=' + soundData.client_id;
    const s_data = JSON.parse(await request(req_url));
    const type = HLSformats[quality].format.mime_type.startsWith('audio/ogg')
        ? StreamType.OggOpus
        : StreamType.Arbitrary;
    return new Stream(s_data.url, type);
}
/**
 * Function to get Free Client ID of soundcloud.
 * @returns client ID
 */
export async function getFreeClientID(): Promise<string> {
    const data = await request('https://soundcloud.com/');
    const splitted = data.split('<script crossorigin src="');
    const urls: string[] = [];
    splitted.forEach((r) => {
        if (r.startsWith('https')) {
            urls.push(r.split('"')[0]);
        }
    });
    const data2 = await request(urls[urls.length - 1]);
    return data2.split(',client_id:"')[1].split('"')[0];
}

/**
 * Type for SoundCloud Stream
 */
export type SoundCloudStream = Stream;
/**
 * Function for creating a Stream of soundcloud using a SoundCloud Track Class
 * @param data SoundCloud Track Class
 * @param quality Quality to select from
 * @returns SoundCloud Stream
 */
export async function stream_from_info(data: SoundCloudTrack, quality?: number): Promise<SoundCloudStream> {
    const HLSformats = parseHlsFormats(data.formats);
    if (typeof quality !== 'number') quality = HLSformats.length - 1;
    else if (quality <= 0) quality = 0;
    else if (quality >= HLSformats.length) quality = HLSformats.length - 1;
    const req_url = HLSformats[quality].url + '?client_id=' + soundData.client_id;
    const s_data = JSON.parse(await request(req_url));
    const type = HLSformats[quality].format.mime_type.startsWith('audio/ogg')
        ? StreamType.OggOpus
        : StreamType.Arbitrary;
    return new Stream(s_data.url, type);
}
/**
 * Function to check client ID
 * @param id Client ID
 * @returns boolean
 */
export async function check_id(id: string): Promise<boolean> {
    const response = await request(`https://api-v2.soundcloud.com/search?client_id=${id}&q=Rick+Roll&limit=0`).catch(
        (err: Error) => {
            return err;
        }
    );
    if (response instanceof Error) return false;
    else return true;
}
/**
 * Function to validate for a soundcloud url
 * @param url soundcloud url
 * @returns "false" | 'track' | 'playlist'
 */
export async function so_validate(url: string): Promise<false | 'track' | 'playlist' | 'search'> {
    if (!url.match(pattern)) return 'search';
    const data = await request(
        `https://api-v2.soundcloud.com/resolve?url=${url}&client_id=${soundData.client_id}`
    ).catch((err: Error) => err);

    if (data instanceof Error) return false;

    const json_data = JSON.parse(data);
    if (json_data.kind === 'track') return 'track';
    else if (json_data.kind === 'playlist') return 'playlist';
    else return false;
}
/**
 * Function to select only hls streams from SoundCloud format array
 * @param data SoundCloud Track Format data
 * @returns a new array containing hls formats
 */
function parseHlsFormats(data: SoundCloudTrackFormat[]) {
    const result: SoundCloudTrackFormat[] = [];
    data.forEach((format) => {
        if (format.format.protocol === 'hls') result.push(format);
    });
    return result;
}

export function setSoundCloudToken(options: SoundDataOptions) {
    soundData = options;
}
