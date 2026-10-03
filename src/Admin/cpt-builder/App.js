/**
 * WordPress dependencies
 */
import { Notice } from '@wordpress/components';
import { useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { fetchDefinitions } from './api';
import DefinitionForm from './DefinitionForm';
import DefinitionList from './DefinitionList';

const VIEW_LIST = 'list';
const VIEW_CREATE = 'create';
const VIEW_EDIT = 'edit';

/**
 * App shell: owns the definitions list and switches between the list view and the create/edit
 * form (DefinitionForm). Mounted by src/Admin/cpt-builder.js onto Admin_Page::render_page()'s
 * root element.
 */
export default function App() {
    const [view, setView] = useState(VIEW_LIST);
    const [definitions, setDefinitions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingEntry, setEditingEntry] = useState(null);
    const [notice, setNotice] = useState(null);

    const loadDefinitions = () => {
        setIsLoading(true);
        return fetchDefinitions()
            .then((items) => setDefinitions(items))
            .catch(() =>
                setNotice({
                    status: 'error',
                    message: __('Could not load CPT definitions.', 'odiseiaframework'),
                })
            )
            .finally(() => setIsLoading(false));
    };

    useEffect(() => {
        loadDefinitions();
        // Only on mount: subsequent reloads happen explicitly after a successful save.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleCreate = () => {
        setEditingEntry(null);
        setView(VIEW_CREATE);
    };

    const handleEdit = (entry) => {
        setEditingEntry(entry);
        setView(VIEW_EDIT);
    };

    const handleCancel = () => {
        setView(VIEW_LIST);
    };

    const handleSaved = () => {
        setView(VIEW_LIST);
        setNotice({
            status: 'success',
            // The admin page only registers the new post type on the next `init`: the browser
            // tab currently open was rendered before it existed, so the menu needs a reload.
            message: __(
                'Saved. The new post type appears in the admin menu after the page reloads.',
                'odiseiaframework'
            ),
        });
        loadDefinitions();
    };

    // The definition being edited is allowed to "conflict" with its own existing slug (see
    // validateSlug()'s currentSlug option), so it is excluded from the conflict list here.
    const existingSlugs = definitions
        .map((entry) => entry.slug)
        .filter((slug) => !editingEntry || slug !== editingEntry.slug);

    return (
        <div className="odiseia-cpt-builder-app">
            {notice && (
                <Notice status={notice.status} onRemove={() => setNotice(null)}>
                    {notice.message}
                </Notice>
            )}

            {VIEW_LIST === view && (
                <DefinitionList
                    definitions={definitions}
                    isLoading={isLoading}
                    onCreate={handleCreate}
                    onEdit={handleEdit}
                    onChanged={loadDefinitions}
                />
            )}

            {VIEW_LIST !== view && (
                <DefinitionForm
                    entry={editingEntry}
                    existingSlugs={existingSlugs}
                    onCancel={handleCancel}
                    onSaved={handleSaved}
                />
            )}
        </div>
    );
}
