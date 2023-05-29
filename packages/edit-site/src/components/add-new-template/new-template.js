/**
 * External dependencies
 */
import classnames from 'classnames';

/**
 * WordPress dependencies
 */
import {
	Button,
	Modal,
	__experimentalGrid as Grid,
	__experimentalText as Text,
	__experimentalVStack as VStack,
} from '@wordpress/components';
import { decodeEntities } from '@wordpress/html-entities';
import { useState } from '@wordpress/element';
import { useDispatch } from '@wordpress/data';
import { store as coreStore } from '@wordpress/core-data';
import { plus } from '@wordpress/icons';
import { __, sprintf } from '@wordpress/i18n';
import { store as noticesStore } from '@wordpress/notices';
import { privateApis as routerPrivateApis } from '@wordpress/router';

/**
 * Internal dependencies
 */
import AddCustomTemplateModalContent from './add-custom-template-modal-content';
import {
	useExistingTemplates,
	useDefaultTemplateTypes,
	useTaxonomiesMenuItems,
	usePostTypeMenuItems,
	useAuthorMenuItem,
	usePostTypeArchiveMenuItems,
} from './utils';
import AddCustomGenericTemplateModalContent from './add-custom-generic-template-modal-content';
import TemplateActionsLoadingScreen from './template-actions-loading-screen';
import { store as editSiteStore } from '../../store';
import { unlock } from '../../private-apis';

const { useHistory } = unlock( routerPrivateApis );

const DEFAULT_TEMPLATE_SLUGS = [
	'front-page',
	'home',
	'single',
	'page',
	'index',
	'archive',
	'author',
	'category',
	'date',
	'tag',
	'taxonomy',
	'search',
	'404',
];

function TemplateListItem( { title, description, onClick } ) {
	return (
		<Button onClick={ onClick }>
			<VStack
				as="span"
				spacing={ 2 }
				justify="flex-start"
				style={ { width: '100%' } }
			>
				<Text
					weight={ 500 }
					lineHeight={ 1.53846153846 } // 20px
				>
					{ title }
				</Text>
				<Text
					lineHeight={ 1.53846153846 } // 20px
				>
					{ description }
				</Text>
			</VStack>
		</Button>
	);
}

const modalContentMap = {
	templatesList: 1,
	customTemplate: 2,
	customGenericTemplate: 3,
};

export default function NewTemplate( {
	postType,
	toggleProps,
	showIcon = true,
} ) {
	const [ showModal, setShowModal ] = useState( false );
	const [ modalContent, setModalContent ] = useState(
		modalContentMap.templatesList
	);
	const [ entityForSuggestions, setEntityForSuggestions ] = useState( {} );
	const [ isCreatingTemplate, setIsCreatingTemplate ] = useState( false );

	const history = useHistory();
	const { saveEntityRecord } = useDispatch( coreStore );
	const { createErrorNotice, createSuccessNotice } =
		useDispatch( noticesStore );
	const { setTemplate } = unlock( useDispatch( editSiteStore ) );
	async function createTemplate( template, isWPSuggestion = true ) {
		if ( isCreatingTemplate ) {
			return;
		}
		setIsCreatingTemplate( true );
		try {
			const { title, description, slug } = template;
			const newTemplate = await saveEntityRecord(
				'postType',
				'wp_template',
				{
					description,
					// Slugs need to be strings, so this is for template `404`
					slug: slug.toString(),
					status: 'publish',
					title,
					// This adds a post meta field in template that is part of `is_custom` value calculation.
					is_wp_suggestion: isWPSuggestion,
				},
				{ throwOnError: true }
			);

			// Set template before navigating away to avoid initial stale value.
			setTemplate( newTemplate.id, newTemplate.slug );

			// Navigate to the created template editor.
			history.push( {
				postId: newTemplate.id,
				postType: newTemplate.type,
				canvas: 'edit',
			} );

			createSuccessNotice(
				sprintf(
					// translators: %s: Title of the created template e.g: "Category".
					__( '"%s" successfully created.' ),
					decodeEntities( newTemplate.title?.rendered || title )
				),
				{
					type: 'snackbar',
				}
			);
		} catch ( error ) {
			const errorMessage =
				error.message && error.code !== 'unknown_error'
					? error.message
					: __( 'An error occurred while creating the template.' );

			createErrorNotice( errorMessage, {
				type: 'snackbar',
			} );
		} finally {
			setIsCreatingTemplate( false );
		}
	}
	const onModalClose = () => {
		setShowModal( false );
		setModalContent( modalContentMap.templatesList );
	};

	const missingTemplates = useMissingTemplates( setEntityForSuggestions, () =>
		setModalContent( modalContentMap.customTemplate )
	);
	if ( ! missingTemplates.length ) {
		return null;
	}
	const { as: Toggle = Button, ...restToggleProps } = toggleProps ?? {};

	let modalTitle = __( 'Add template' );
	if ( modalContent === modalContentMap.customTemplate ) {
		modalTitle = sprintf(
			// translators: %s: Name of the post type e.g: "Post".
			__( 'Add template: %s' ),
			entityForSuggestions.labels.singular_name
		);
	} else if ( modalContent === modalContentMap.customGenericTemplate ) {
		modalTitle = __( 'Create custom template' );
	}
	return (
		<>
			{ isCreatingTemplate && <TemplateActionsLoadingScreen /> }
			<Toggle
				{ ...restToggleProps }
				onClick={ () => setShowModal( true ) }
				icon={ showIcon ? plus : null }
				label={ postType.labels.add_new_item }
			>
				{ showIcon ? null : postType.labels.add_new_item }
			</Toggle>
			{ showModal && (
				<Modal
					title={ modalTitle }
					className={ classnames(
						'edit-site-add-new-template__modal',
						{
							'edit-site-add-new-template__modal_template_list':
								modalContent === modalContentMap.templatesList,
							'edit-site-custom-template-modal':
								modalContent === modalContentMap.customTemplate,
						}
					) }
					onRequestClose={ onModalClose }
					overlayClassName={
						modalContent === modalContentMap.customGenericTemplate
							? 'edit-site-custom-generic-template__modal'
							: undefined
					}
				>
					{ modalContent === modalContentMap.templatesList && (
						<Grid
							columns={ 3 }
							gap={ 4 }
							align="flex-start"
							justify="center"
							className="edit-site-add-new-template__template-list__contents"
						>
							{ missingTemplates.map( ( template ) => {
								const { title, description, slug, onClick } =
									template;
								return (
									<TemplateListItem
										key={ slug }
										title={ title }
										description={ description }
										onClick={ () =>
											onClick
												? onClick( template )
												: createTemplate( template )
										}
									/>
								);
							} ) }
							<TemplateListItem
								title={ __( 'Custom template' ) }
								description={ __(
									'A custom template can be manually applied to any post or page.'
								) }
								onClick={ () =>
									setModalContent(
										modalContentMap.customGenericTemplate
									)
								}
							/>
						</Grid>
					) }
					{ modalContent === modalContentMap.customTemplate && (
						<AddCustomTemplateModalContent
							onSelect={ createTemplate }
							entityForSuggestions={ entityForSuggestions }
						/>
					) }
					{ modalContent ===
						modalContentMap.customGenericTemplate && (
						<AddCustomGenericTemplateModalContent
							onClose={ onModalClose }
							createTemplate={ createTemplate }
						/>
					) }
				</Modal>
			) }
		</>
	);
}

function useMissingTemplates( setEntityForSuggestions, onClick ) {
	const existingTemplates = useExistingTemplates();
	const defaultTemplateTypes = useDefaultTemplateTypes();
	const existingTemplateSlugs = ( existingTemplates || [] ).map(
		( { slug } ) => slug
	);
	const missingDefaultTemplates = ( defaultTemplateTypes || [] ).filter(
		( template ) =>
			DEFAULT_TEMPLATE_SLUGS.includes( template.slug ) &&
			! existingTemplateSlugs.includes( template.slug )
	);
	const onClickMenuItem = ( _entityForSuggestions ) => {
		onClick?.();
		setEntityForSuggestions( _entityForSuggestions );
	};
	// We need to replace existing default template types with
	// the create specific template functionality. The original
	// info (title, description, etc.) is preserved in the
	// used hooks.
	const enhancedMissingDefaultTemplateTypes = [ ...missingDefaultTemplates ];
	const { defaultTaxonomiesMenuItems, taxonomiesMenuItems } =
		useTaxonomiesMenuItems( onClickMenuItem );
	const { defaultPostTypesMenuItems, postTypesMenuItems } =
		usePostTypeMenuItems( onClickMenuItem );

	const authorMenuItem = useAuthorMenuItem( onClickMenuItem );
	[
		...defaultTaxonomiesMenuItems,
		...defaultPostTypesMenuItems,
		authorMenuItem,
	].forEach( ( menuItem ) => {
		if ( ! menuItem ) {
			return;
		}
		const matchIndex = enhancedMissingDefaultTemplateTypes.findIndex(
			( template ) => template.slug === menuItem.slug
		);
		// Some default template types might have been filtered above from
		// `missingDefaultTemplates` because they only check for the general
		// template. So here we either replace or append the item, augmented
		// with the check if it has available specific item to create a
		// template for.
		if ( matchIndex > -1 ) {
			enhancedMissingDefaultTemplateTypes[ matchIndex ] = menuItem;
		} else {
			enhancedMissingDefaultTemplateTypes.push( menuItem );
		}
	} );
	// Update the sort order to match the DEFAULT_TEMPLATE_SLUGS order.
	enhancedMissingDefaultTemplateTypes?.sort( ( template1, template2 ) => {
		return (
			DEFAULT_TEMPLATE_SLUGS.indexOf( template1.slug ) -
			DEFAULT_TEMPLATE_SLUGS.indexOf( template2.slug )
		);
	} );
	const missingTemplates = [
		...enhancedMissingDefaultTemplateTypes,
		...usePostTypeArchiveMenuItems(),
		...postTypesMenuItems,
		...taxonomiesMenuItems,
	];
	return missingTemplates;
}
